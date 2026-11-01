import assert from "node:assert/strict";
import { test } from "node:test";

import {
  findRepoSource,
  isNoCardRefusal,
  REFRESH_GIVE_UP_MS,
  refreshPollDelayMs,
  resolveInstallTarget,
  sdCardPresent,
  snapshotFromBadge,
  snapshotFromRow,
  visibleStorage,
} from "./firmwarePage.ts";

test("polling backs off from 2 s to 5 s to 10 s", () => {
  assert.equal(refreshPollDelayMs(0), 2_000);
  assert.equal(refreshPollDelayMs(29_999), 2_000);
  assert.equal(refreshPollDelayMs(30_000), 5_000);
  assert.equal(refreshPollDelayMs(119_999), 5_000);
  assert.equal(refreshPollDelayMs(120_000), 10_000);
  assert.equal(refreshPollDelayMs(REFRESH_GIVE_UP_MS - 1), 10_000);
});

test("polling gives up just past the daemon's 600 s claim, not before", () => {
  assert.ok(REFRESH_GIVE_UP_MS > 600_000);
  assert.ok(REFRESH_GIVE_UP_MS <= 12 * 60_000);
  assert.equal(refreshPollDelayMs(REFRESH_GIVE_UP_MS), null);
  assert.equal(refreshPollDelayMs(REFRESH_GIVE_UP_MS * 2), null);
});

test("eleven minutes of polling is under a hundred requests, not 330", () => {
  let t = 0;
  let polls = 0;
  for (;;) {
    const d = refreshPollDelayMs(t);
    if (d === null) break;
    assert.ok(d >= 2_000);
    t += d;
    polls += 1;
  }
  assert.ok(polls < 100, String(polls));
});

const cand = (version, relation = "unknown", trust = "verified") => ({
  version,
  relation,
  trust,
});
const fork = {
  id: "fork",
  label: "this fork",
  kind: "github",
  location: "excavador-turing/BMC-Firmware",
  candidates: [cand("v2.44.0", "current"), cand("v2.1.0", "older")],
};
const upstream = {
  id: "turingpi",
  label: "Turing Pi",
  kind: "github",
  location: "turing-machines/BMC-Firmware",
  candidates: [cand("v2.0.5", "older")],
};
const mirror = {
  id: "mirror",
  label: "mirror",
  kind: "http",
  location: "https://example.com/fw",
  candidates: [cand("v2.46.1", "newer", "tls")],
};
const card = {
  id: "local",
  label: "SD card",
  kind: "local",
  location: "/mnt/sdcard/firmware",
  candidates: [{ ...cand("v2.46.1", "newer", "unverified"), file: "/x.tpu" }],
};
const repo = "excavador-turing/BMC-Firmware";

test("the source that is the named repository wins, listed or not", () => {
  assert.deepEqual(resolveInstallTarget([upstream, fork], "v2.44.0", repo), {
    sourceId: "fork",
    listed: true,
  });
  assert.deepEqual(resolveInstallTarget([upstream, fork], "v2.46.1", repo), {
    sourceId: "fork",
    listed: false,
  });
});

test("another remote or a parked file listing the same version never wins", () => {
  // The mirror and the card both list v2.46.1; the fork does not yet.
  assert.deepEqual(
    resolveInstallTarget([mirror, card, upstream, fork], "v2.46.1", repo),
    { sourceId: "fork", listed: false }
  );
  // Even when the other source is first in the daemon's order.
  assert.deepEqual(resolveInstallTarget([mirror, fork], "v2.46.1", repo), {
    sourceId: "fork",
    listed: false,
  });
});

test("a repository that is a different GitHub source is matched by location, not id", () => {
  const renamed = { ...fork, id: "mine" };
  assert.deepEqual(resolveInstallTarget([upstream, renamed], "v2.46.1", repo), {
    sourceId: "mine",
    listed: false,
  });
});

test("no source for the repository means no install target, not the fork id", () => {
  assert.equal(resolveInstallTarget([upstream, mirror], "v2.46.1", repo), null);
  assert.equal(resolveInstallTarget([], "v2.46.1", repo), null);
  const off = { ...fork, enabled: false };
  assert.equal(findRepoSource([off], repo), undefined);
  assert.equal(findRepoSource([upstream], repo), undefined);
  assert.equal(findRepoSource([mirror, fork], repo)?.id, "fork");
});

const request = { version: "v2.46.1", repo, source: fork };

test("a badge install of an unlisted version is a verified upgrade from the repo", () => {
  const snap = snapshotFromBadge(request, [upstream, fork]);
  assert.equal(snap.sourceId, "fork");
  assert.equal(snap.sourceLabel, "this fork");
  assert.equal(snap.repo, repo);
  assert.equal(snap.listed, false);
  assert.equal(snap.trust, "verified");
  assert.equal(snap.relation, "newer");
  assert.equal(snap.allowDowngrade, false);
  assert.equal(snap.viaBadge, true);
  assert.equal(snap.localFile, undefined);
});

test("a synthesized candidate is not verified unless the source is the named repo", () => {
  const elsewhere = {
    ...request,
    source: { ...fork, location: "someone/else" },
  };
  assert.equal(snapshotFromBadge(elsewhere, []).trust, "unverified");
});

test("a badge install of a listed version takes the row's trust and never allows a downgrade", () => {
  const listedFork = {
    ...fork,
    candidates: [cand("v2.46.1", "unknown", "verified"), ...fork.candidates],
  };
  const snap = snapshotFromBadge(request, [listedFork]);
  assert.equal(snap.listed, true);
  assert.equal(snap.relation, "newer");
  assert.equal(snap.allowDowngrade, false);
});

test("allow_downgrade goes with a badge install only when the list says it is older", () => {
  const older = {
    ...fork,
    candidates: [cand("v2.46.1", "older", "verified")],
  };
  const snap = snapshotFromBadge(request, [older]);
  assert.equal(snap.relation, "older");
  assert.equal(snap.allowDowngrade, true);
});

test("the snapshot does not change when the catalogue does", () => {
  const sources = [fork];
  const snap = snapshotFromBadge(request, sources);
  const before = JSON.stringify(snap);
  // The refresh lands: the version appears, from a different source too.
  sources[0] = { ...fork, candidates: [cand("v2.46.1", "older", "tls")] };
  sources.push(mirror);
  assert.equal(JSON.stringify(snap), before);
});

test("a row's install is what the list shows, with the old downgrade rule", () => {
  const row = snapshotFromRow(fork, fork.candidates[1]);
  assert.equal(row.viaBadge, false);
  assert.equal(row.listed, true);
  assert.equal(row.allowDowngrade, true);
  assert.equal(row.localFile, undefined);
  const parked = snapshotFromRow(card, card.candidates[0]);
  assert.equal(parked.localFile, "/x.tpu");
  assert.equal(parked.repo, null);
  assert.equal(parked.allowDowngrade, false);
  assert.equal(
    snapshotFromRow(upstream, upstream.candidates[0]).repo,
    "turing-machines/BMC-Firmware"
  );
});

const bmc = { name: "BMC", total_bytes: 144683008, bytes_free: 144596992 };
const sd = {
  name: "SD card",
  total_bytes: 31231758336,
  bytes_free: 24024563712,
};

test("a card is present when the list has one of its own size", () => {
  assert.equal(sdCardPresent([bmc, sd]), true);
});

test("no SD entry means no card", () => {
  assert.equal(sdCardPresent([bmc]), false);
  assert.equal(sdCardPresent([]), false);
});

test("an SD entry that is the BMC's own volume is an empty mount point", () => {
  assert.equal(
    sdCardPresent([bmc, { ...sd, total_bytes: bmc.total_bytes }]),
    false
  );
});

test("an unreadable list is not an answer", () => {
  assert.equal(sdCardPresent(undefined), null);
  assert.equal(sdCardPresent(null), null);
});

test("every bmcd wording of the no-card refusal is recognised", () => {
  for (const text of [
    "/mnt/sdcard is not mounted, so there is no card to park an image on. Insert one, or upload without parking to install straight away.",
    "the microSD card is not mounted",
    "the image was not saved: an SD card is inserted but not mounted (unsupported or damaged filesystem?). Install it straight away with `tpi firmware upload` without `--park` (the web interface's install option does the same).",
    "the image was not saved: no SD card is mounted at /mnt/sdcard. Insert a card and try again, or install it straight away with `tpi firmware upload` without `--park` (the web interface's install option does the same).",
  ]) {
    assert.equal(isNoCardRefusal(text), true, text);
  }
});

test("other failures are not mistaken for a missing card", () => {
  for (const text of [
    // Not knowing whether there is a card is not knowing there is none: the
    // error is shown, and installing directly is not offered.
    "the image was not saved: cannot tell whether /mnt/sdcard is mounted: Input/output error (os error 5)",
    "the card has 1 MB free and the image is 37 MB",
    "/ is not mounted",
    "an update is already staged for the next boot",
    "",
    undefined,
    null,
  ]) {
    assert.equal(isNoCardRefusal(text), false, String(text));
  }
});

test("bmcd 2.42.2: mounted true is a card, whatever the sizes say", () => {
  assert.equal(sdCardPresent([bmc, { ...sd, mounted: true }]), true);
  assert.equal(
    sdCardPresent([
      bmc,
      { ...sd, total_bytes: bmc.total_bytes, mounted: true },
    ]),
    true
  );
});

test("bmcd 2.42.2: mounted false is no card, whatever the sizes say", () => {
  assert.equal(sdCardPresent([bmc, { ...sd, mounted: false }]), false);
  assert.equal(
    sdCardPresent([bmc, { ...bmc, name: "SD card", mounted: false }]),
    false
  );
});

test("before bmcd 2.42.2 there is no mounted key and the sizes decide", () => {
  assert.equal("mounted" in sd, false);
  assert.equal(sdCardPresent([bmc, sd]), true);
  assert.equal(sdCardPresent([bmc, { ...bmc, name: "SD card" }]), false);
});

test("an SD card that is not mounted is not drawn; every other volume is", () => {
  const gone = { ...bmc, name: "SD card", mounted: false };
  assert.deepEqual(visibleStorage([bmc, gone]), [bmc]);
  const there = { ...sd, mounted: true };
  assert.deepEqual(visibleStorage([bmc, there]), [bmc, there]);
  assert.deepEqual(visibleStorage([bmc, sd]), [bmc, sd]);
});
