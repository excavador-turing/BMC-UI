import assert from "node:assert/strict";
import { test } from "node:test";

import { classifyApply, switchApplyBody } from "./switchApply.ts";

const refused = (status, result) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data: { response: [{ result }] } },
  });

// The sentences the daemon sends (bmcd's switch_service.rs).
const HAND_WRITTEN =
  "/etc/network/interfaces was written by hand, and LACP needs bond0 declared in it. " +
  "To go ahead, tick the option to replace the hand-written file in the interface, " +
  "or send `replace_hand_written: true` in the request. Nothing was changed.";
const UNREADABLE =
  "/etc/network/interfaces was written by hand and the address in its br0 stanza " +
  "cannot be read, so replacing the file would change how this board gets its " +
  "address. Nothing was changed.";
const BOND_EXISTS =
  "bond0 already exists on this board and this daemon did not create it. " +
  "Nothing was changed.";

test("a 409 that asks for replace_hand_written is the checkbox case", () => {
  const r = classifyApply(refused(409, HAND_WRITTEN));
  assert.equal(r.kind, "hand_written");
  assert.equal(r.message, HAND_WRITTEN);
});

test("an unreadable br0 address is not something a checkbox fixes", () => {
  assert.equal(classifyApply(refused(409, UNREADABLE)).kind, "other");
});

test("a bond0 the daemon did not make is its own case", () => {
  assert.equal(classifyApply(refused(409, BOND_EXISTS)).kind, "bond_exists");
});

test("only a 409 is either case", () => {
  assert.equal(classifyApply(refused(400, HAND_WRITTEN)).kind, "other");
  assert.equal(classifyApply(refused(500, BOND_EXISTS)).kind, "other");
  assert.equal(classifyApply(new Error("Network Error")).kind, "other");
});

test("replace_hand_written is sent only once it was agreed to", () => {
  const doc = { vlan_filtering: true, stp: false, ports: {} };
  assert.deepEqual(switchApplyBody(doc, null, false), doc);
  assert.deepEqual(switchApplyBody(doc, 45, false), { ...doc, window_s: 45 });
  assert.deepEqual(switchApplyBody(doc, null, true), {
    ...doc,
    replace_hand_written: true,
  });
  assert.equal(
    "replace_hand_written" in switchApplyBody(doc, 45, false),
    false
  );
});
