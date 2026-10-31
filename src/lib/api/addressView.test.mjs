import assert from "node:assert/strict";
import { test } from "node:test";

import {
  addressedInterfaces,
  APPLY_FAILED_SHOWN_MS,
  applyBody,
  applyFailedShown,
  managedPresent,
  needsReplaceConsent,
  orderInterfaces,
  timeMillis,
} from "./addressView.ts";
import { bmcdMessage } from "./bmcdMessage.ts";

const NOW = 1_800_000_000_000;
const failed = (at) => ({
  reason: "apply_failed",
  at,
  document: { mode: "dhcp" },
});

test("a failed apply shows for ten minutes, then is history", () => {
  const secs = NOW / 1000;
  assert.equal(applyFailedShown(failed(secs - 5), NOW), true);
  assert.equal(
    applyFailedShown(failed(secs - APPLY_FAILED_SHOWN_MS / 1000 + 1), NOW),
    true
  );
  assert.equal(
    applyFailedShown(failed(secs - APPLY_FAILED_SHOWN_MS / 1000 - 1), NOW),
    false
  );
});

test("the banner reads the daemon's own time shapes too", () => {
  const recent = {
    secs_since_epoch: NOW / 1000 - 30,
    nanos_since_epoch: 0,
  };
  assert.equal(applyFailedShown(failed(recent), NOW), true);
  assert.equal(
    applyFailedShown(failed(new Date(NOW - 60_000).toISOString()), NOW),
    true
  );
  assert.equal(timeMillis(1_800_000_000), NOW);
});

test("only an apply_failed revert, with a time anyone can read, is a banner", () => {
  const secs = NOW / 1000 - 5;
  assert.equal(applyFailedShown(null, NOW), false);
  assert.equal(applyFailedShown(undefined, NOW), false);
  assert.equal(
    applyFailedShown({ ...failed(secs), reason: "not_confirmed" }, NOW),
    false
  );
  assert.equal(applyFailedShown(failed(undefined), NOW), false);
  assert.equal(applyFailedShown(failed("not a time"), NOW), false);
});

test("default-route interface first, the rest in the order sent", () => {
  const ordered = orderInterfaces([
    { name: "br-lan", addresses: ["192.0.2.1/24"] },
    { name: "lo2", addresses: [] },
    { name: "br-wan", addresses: ["198.51.100.20/24"], default_route: true },
  ]);
  assert.deepEqual(
    ordered.map((i) => i.name),
    ["br-wan", "br-lan", "lo2"]
  );
});

test("an older daemon sends no interfaces and that is an empty list", () => {
  assert.deepEqual(orderInterfaces(undefined), []);
  assert.deepEqual(addressedInterfaces(undefined), []);
});

test("the dashboard lists only interfaces that carry an address", () => {
  const list = addressedInterfaces([
    { name: "eth0", addresses: [] },
    { name: "br-lan", addresses: ["192.0.2.1/24"] },
    { name: "br-wan", addresses: ["198.51.100.20/24"], default_route: true },
  ]);
  assert.deepEqual(
    list.map((i) => i.name),
    ["br-wan", "br-lan"]
  );
});

test("an absent managed_interface_present is a bridge that is there", () => {
  assert.equal(managedPresent({}), true);
  assert.equal(managedPresent({ managed_interface_present: true }), true);
  assert.equal(managedPresent({ managed_interface_present: false }), false);
});

test("a hand-written or unreadable file needs consent, where the page applies", () => {
  assert.equal(needsReplaceConsent({ file: "bmcd" }), false);
  assert.equal(needsReplaceConsent({ file: "hand_edited" }), true);
  assert.equal(needsReplaceConsent({ file: "unreadable" }), true);
  // No bridge: the page cannot apply at all, so there is nothing to consent to.
  assert.equal(
    needsReplaceConsent({
      file: "hand_edited",
      managed_interface_present: false,
    }),
    false
  );
});

test("the apply body carries replace_hand_written only once agreed", () => {
  const doc = { mode: "dhcp" };
  assert.deepEqual(applyBody(doc, null, false), { mode: "dhcp" });
  assert.ok(!("replace_hand_written" in applyBody(doc, 30, false)));
  assert.deepEqual(applyBody(doc, 45, true), {
    mode: "dhcp",
    window_s: 45,
    replace_hand_written: true,
  });
});

test("the apply body does not alter the document it was built from", () => {
  const doc = { mode: "static", address: "192.0.2.5", prefix: 24 };
  applyBody(doc, 30, true);
  assert.deepEqual(doc, { mode: "static", address: "192.0.2.5", prefix: 24 });
});

test("a 409 shows bmcd's message, not axios's", () => {
  const err = Object.assign(new Error("Request failed with status code 409"), {
    response: {
      status: 409,
      statusText: "Conflict",
      data: {
        response: [
          { result: "this board has no br0 bridge; change it over SSH" },
        ],
      },
    },
  });
  assert.equal(
    bmcdMessage(err),
    "this board has no br0 bridge; change it over SSH"
  );
});
