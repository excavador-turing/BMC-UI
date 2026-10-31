import assert from "node:assert/strict";
import { test } from "node:test";

import { bmcdMessage } from "./bmcdMessage.ts";
import {
  bannerKind,
  parseStorage,
  repairBlocker,
  REPAIR_HEADERS,
  repairBody,
  showReboot,
  showRepair,
} from "./storageView.ts";

const broken = {
  state: "temporary",
  reason: "mount_failed",
  detail: "UBIFS error (ubi0:2): ubifs_recover_leb: LEB 16 scanning failed",
  backing: "ubi",
  repairable: true,
  repair_blocker: null,
};

test("a healthy board has no banner and no repair", () => {
  const view = parseStorage({
    state: "persistent",
    reason: null,
    detail: null,
    backing: "ubi",
    repairable: false,
    repair_blocker: null,
  });
  assert.equal(bannerKind(view), null);
  assert.equal(showRepair(view), false);
});

test("a mount that failed is the factory-defaults banner, with a repair", () => {
  const view = parseStorage(broken);
  assert.equal(bannerKind(view), "unmounted");
  assert.equal(showRepair(view), true);
  assert.match(view.detail, /ubifs_recover_leb/);
});

test("an unrecorded reason, a missing one and an unknown one say the same", () => {
  for (const reason of ["unrecorded", null, undefined, "something_new"]) {
    const view = parseStorage({ ...broken, reason });
    assert.equal(bannerKind(view), "unmounted", String(reason));
  }
});

test("KEY1 held is its own banner, and never offers to remove the volume", () => {
  const view = parseStorage({
    ...broken,
    reason: "requested",
    detail: null,
    repairable: true,
  });
  assert.equal(bannerKind(view), "keyhold");
  assert.equal(showRepair(view), false);
  assert.equal(repairBlocker(view), null);
});

test("not repairable shows the blocker instead of the button", () => {
  const view = parseStorage({
    ...broken,
    repairable: false,
    repair_blocker: "A firmware update is staged; reboot to finish it first.",
  });
  assert.equal(bannerKind(view), "unmounted");
  assert.equal(showRepair(view), false);
  assert.equal(
    repairBlocker(view),
    "A firmware update is staged; reboot to finish it first."
  );
  // Repairable: the blocker is not shown even if the daemon left one behind.
  assert.equal(
    repairBlocker(parseStorage({ ...broken, repair_blocker: "stale" })),
    null
  );
  // Not repairable and nothing said: neither a button nor a sentence.
  assert.equal(
    repairBlocker(parseStorage({ ...broken, repairable: false })),
    null
  );
});

test("unknown state raises nothing", () => {
  for (const state of ["unknown", "weird", undefined, 7]) {
    const view = parseStorage({ ...broken, state });
    assert.equal(bannerKind(view), null, String(state));
    assert.equal(showRepair(view), false, String(state));
  }
});

test("an answer that is not the daemon's reads as no answer", () => {
  for (const data of [null, undefined, "<!doctype html>", 3, [], true]) {
    assert.equal(parseStorage(data), null);
  }
  assert.equal(bannerKind(null), null);
  assert.equal(bannerKind(undefined), null);
  assert.equal(showRepair(null), false);
  assert.equal(repairBlocker(undefined), null);
});

test("missing and mistyped fields fall back to the quiet value", () => {
  const view = parseStorage({ state: "temporary" });
  assert.deepEqual(view, {
    state: "temporary",
    reason: null,
    detail: null,
    backing: "unknown",
    repairable: false,
    repair_blocker: null,
  });
  const odd = parseStorage({
    ...broken,
    repairable: "yes",
    detail: 5,
    backing: "tape",
  });
  assert.equal(odd.repairable, false);
  assert.equal(odd.detail, null);
  assert.equal(odd.backing, "unknown");
  // A blank detail is no detail: no empty disclosure.
  assert.equal(parseStorage({ ...broken, detail: "  " }).detail, null);
});

test("the plain reboot is offered wherever the mount failed, repairable or not", () => {
  assert.equal(showReboot(parseStorage(broken)), true);
  const blocked = parseStorage({
    ...broken,
    repairable: false,
    repair_blocker:
      "There is no settings volume to remove; reboot the BMC to recreate it.",
  });
  assert.equal(showRepair(blocked), false);
  assert.equal(showReboot(blocked), true);
  assert.equal(
    showReboot(parseStorage({ ...broken, reason: "unrecorded" })),
    true
  );
  // Not with KEY1 held, not on a healthy or unreadable answer.
  assert.equal(
    showReboot(parseStorage({ ...broken, reason: "requested" })),
    false
  );
  assert.equal(showReboot(parseStorage({ state: "persistent" })), false);
  assert.equal(showReboot(null), false);
});

test("the repair request carries the confirmation the daemon demands", () => {
  assert.deepEqual(REPAIR_HEADERS, { "Content-Type": "application/json" });
  assert.deepEqual(repairBody(), { confirm: true });
  assert.equal(JSON.stringify(repairBody()), '{"confirm":true}');
});

test("a refused repair shows the daemon's own words", () => {
  const error = Object.assign(
    new Error("Request failed with status code 409"),
    {
      response: {
        status: 409,
        data: { response: [{ result: "a firmware update is staged" }] },
      },
    }
  );
  assert.equal(bmcdMessage(error), "a firmware update is staged");
});
