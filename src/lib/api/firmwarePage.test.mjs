import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isNoCardRefusal,
  REFRESH_GIVE_UP_MS,
  refreshPollDelayMs,
  resolveInstallTarget,
  sdCardPresent,
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

const fork = {
  id: "fork",
  kind: "github",
  location: "excavador-turing/BMC-Firmware",
  candidates: [{ version: "v2.44.0" }, { version: "v2.1.0" }],
};
const upstream = {
  id: "turingpi",
  kind: "github",
  location: "turing-machines/BMC-Firmware",
  candidates: [{ version: "v2.0.5" }],
};
const card = {
  id: "local",
  kind: "local",
  location: "/mnt/sdcard/firmware",
  candidates: [{ version: "v2.46.1" }],
};
const repo = "excavador-turing/BMC-Firmware";

test("a version the fork's list has installs from the fork, like its row", () => {
  assert.deepEqual(
    resolveInstallTarget([upstream, fork, card], "v2.44.0", repo),
    { sourceId: "fork", listed: true }
  );
});

test("a version only a parked file has installs from the card", () => {
  assert.deepEqual(
    resolveInstallTarget([upstream, fork, card], "v2.46.1", repo),
    { sourceId: "local", listed: true }
  );
});

test("a version no list has goes to the fork's repository, unlisted", () => {
  assert.deepEqual(resolveInstallTarget([upstream, fork], "v2.46.1", repo), {
    sourceId: "fork",
    listed: false,
  });
});

test("an unlisted version goes to whichever source holds that repository", () => {
  const renamed = { ...fork, id: "mine" };
  assert.deepEqual(resolveInstallTarget([upstream, renamed], "v2.46.1", repo), {
    sourceId: "mine",
    listed: false,
  });
});

test("with no catalogue yet, the shipped fork source is the answer", () => {
  assert.deepEqual(resolveInstallTarget([], "v2.46.1", repo), {
    sourceId: "fork",
    listed: false,
  });
  assert.deepEqual(resolveInstallTarget([], "v2.46.1", undefined), {
    sourceId: "fork",
    listed: false,
  });
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

test("the daemon's no-card refusal is recognised, other failures are not", () => {
  assert.equal(
    isNoCardRefusal(
      "/mnt/sdcard is not mounted, so there is no card to park an image on. Insert one, or upload without parking to install straight away."
    ),
    true
  );
  assert.equal(isNoCardRefusal("the microSD card is not mounted"), true);
  assert.equal(
    isNoCardRefusal("the card has 1 MB free and the image is 37 MB"),
    false
  );
  assert.equal(isNoCardRefusal("/ is not mounted"), false);
  assert.equal(isNoCardRefusal(undefined), false);
  assert.equal(isNoCardRefusal(null), false);
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
