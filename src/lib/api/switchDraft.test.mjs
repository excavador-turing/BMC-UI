import assert from "node:assert/strict";
import { test } from "node:test";

import {
  documentFrom,
  draftFrom,
  isSlave,
  portOrder,
  unparsed,
  withLag,
  withoutLag,
} from "./switchDraft.ts";

const port = (untagged, tagged = []) => ({ untagged, tagged });

// The board's `trunk` preset: both uplinks tagged, STP deciding.
const trunk = {
  vlan_filtering: true,
  stp: true,
  second_uplink: "redundant",
  ports: {
    node1: port(20),
    node2: port(20),
    node3: port(20),
    node4: port(20),
    bmc: port(10),
    ge0: port(null, [10, 20]),
    ge1: port(null, [10, 20]),
  },
  names: { 10: "management", 20: "nodes" },
};

// The board's `trunk-lag` preset: the same trunk on bond0.
const trunkLag = {
  ...trunk,
  stp: false,
  second_uplink: "lag",
  ports: {
    ...trunk.ports,
    ge0: port(null),
    ge1: port(null),
    bond0: port(null, [10, 20]),
  },
};

test("a document round-trips through the draft unchanged", () => {
  assert.deepEqual(documentFrom(draftFrom(trunk)), trunk);
  assert.deepEqual(documentFrom(draftFrom(trunkLag)), trunkLag);
});

test("a daemon without second_uplink reads as redundant, without bond0", () => {
  const { second_uplink: _, ...old } = trunk;
  const draft = draftFrom(old);
  assert.equal(draft.second_uplink, "redundant");
  assert.equal("bond0" in draft.ports, false);
});

test("LACP moves the uplink VLANs onto bond0 and turns STP off", () => {
  const doc = documentFrom(withLag(draftFrom(trunk)));
  assert.deepEqual(doc, trunkLag);
});

test("leaving LACP puts bond0's VLANs on both uplinks and STP back on", () => {
  const doc = documentFrom(withoutLag(draftFrom(trunkLag)));
  assert.deepEqual(doc, trunk);
});

test("bond0 is a row only with LACP; ge0 and ge1 are its slaves then", () => {
  assert.equal(portOrder(false).includes("bond0"), false);
  assert.deepEqual(portOrder(true).slice(-3), ["ge0", "ge1", "bond0"]);
  assert.equal(isSlave(true, "ge0"), true);
  assert.equal(isSlave(true, "ge1"), true);
  assert.equal(isSlave(true, "bond0"), false);
  assert.equal(isSlave(false, "ge0"), false);
});

test("a half-typed VLAN on bond0 is flagged and blocks the document", () => {
  const draft = draftFrom(trunkLag);
  draft.ports.bond0 = { untagged: "", tagged: "10, x" };
  assert.deepEqual([...unparsed(draft)], ["bond0.tagged"]);
  assert.equal(documentFrom(draft), null);
});
