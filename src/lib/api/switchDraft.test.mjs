import assert from "node:assert/strict";
import { test } from "node:test";

import {
  documentFrom,
  draftFrom,
  isSlave,
  portOrder,
  supportsLag,
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

// The board's `flat` preset and its `flat-lag` twin.
const flat = {
  vlan_filtering: false,
  stp: false,
  second_uplink: "redundant",
  ports: {
    node1: port(1),
    node2: port(1),
    node3: port(1),
    node4: port(1),
    bmc: port(1),
    ge0: port(1),
    ge1: port(1),
  },
  names: {},
};

const flatLag = {
  ...flat,
  second_uplink: "lag",
  ports: {
    ...flat.ports,
    ge0: port(null),
    ge1: port(null),
    bond0: port(1),
  },
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

test("flat and LACP round-trip, and STP stays off on the way back", () => {
  assert.deepEqual(documentFrom(draftFrom(flatLag)), flatLag);
  assert.deepEqual(documentFrom(withLag(draftFrom(flat))), flatLag);
  // Not "flat with STP on", which is no preset the board has.
  assert.deepEqual(documentFrom(withoutLag(draftFrom(flatLag))), flat);
});

test("leaving LACP follows VLAN filtering if it was changed meanwhile", () => {
  const draft = { ...draftFrom(flatLag), filtering: true };
  assert.equal(withoutLag(draft).stp, true);
});

test("LACP is offered only where the board shows it can do it", () => {
  const withLagPreset = [{ document: trunkLag }, { document: trunk }];
  const without = [{ document: trunk }, { document: flat }];
  assert.equal(supportsLag(trunk, withLagPreset), true);
  assert.equal(supportsLag(trunk, without), false);
  // Running it already is proof enough, whatever the presets say.
  assert.equal(supportsLag(trunkLag, without), true);
  // Not yet known: no.
  assert.equal(supportsLag(undefined, undefined), false);
  assert.equal(supportsLag(trunk, undefined), false);
  // An old daemon with no second_uplink anywhere.
  const { second_uplink: _, ...old } = trunk;
  assert.equal(supportsLag(old, [{ document: old }]), false);
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
