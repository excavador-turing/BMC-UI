import assert from "node:assert/strict";
import { test } from "node:test";

import { nodesOnReboot } from "./boardRevision.ts";

test("a v2.4 power-cycles the nodes on any BMC reboot", () => {
  for (const revision of ["v2.4", "v2.4.0", "v2.4.1", "2.4.3", "V2.4.1"]) {
    assert.equal(nodesOnReboot(revision), "power_cycled", revision);
  }
});

test("a v2.5 keeps its nodes running", () => {
  for (const revision of ["v2.5", "v2.5.2", "2.5.0"]) {
    assert.equal(nodesOnReboot(revision), "keep_running", revision);
  }
});

test("an unknown or unreadable revision is neither claim", () => {
  for (const revision of [
    undefined,
    null,
    "",
    "   ",
    "v2.6.0",
    "v2.40",
    "v3.0",
    "v2",
    "v2.",
    "turing",
    24,
    {},
  ]) {
    assert.equal(nodesOnReboot(revision), "unknown", String(revision));
  }
});

test("a NUL-padded EEPROM field still reads", () => {
  assert.equal(nodesOnReboot("v2.4.1\u0000\u0000\u0000"), "power_cycled");
  assert.equal(nodesOnReboot("\u0000\u0000"), "unknown");
});
