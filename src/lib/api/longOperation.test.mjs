import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  LONG_OPERATION_MUTATIONS,
  LONG_OPERATION_QUERIES,
  longOperationRunning,
} from "./longOperation.ts";

const pending = (name) => ({ status: "pending", key: [name] });

test("nothing running is not a long operation", () => {
  assert.equal(longOperationRunning([], []), false);
});

test("an upload, an install, a node flash and a backup each count", () => {
  for (const name of [
    "firmwareUpdateMutation",
    "installFirmware",
    "nodeUpdateMutation",
    "backupMutation",
  ]) {
    assert.equal(longOperationRunning([pending(name)], []), true, name);
  }
});

test("a flash being written counts after its upload is over", () => {
  const over = { status: "success", key: ["nodeUpdateMutation"] };
  assert.equal(longOperationRunning([over], [["flashStatus"]]), true);
  assert.equal(longOperationRunning([over], [["firmwareStatus"]]), true);
});

test("a finished or failed operation does not count", () => {
  for (const status of ["success", "error", "idle"]) {
    assert.equal(
      longOperationRunning([{ status, key: ["installFirmware"] }], []),
      false,
      status
    );
  }
});

test("other mutations and other queries do not count", () => {
  assert.equal(
    longOperationRunning(
      [pending("powerNodeMutation"), { status: "pending", key: undefined }],
      [["health"], ["thermal", 5000], undefined]
    ),
    false
  );
});

test("every name guarded is a key this interface really uses", () => {
  // A rename of a key would silently lift the guard; fail here instead.
  const dir = new URL(".", import.meta.url);
  const source = ["file.ts", "set.ts", "get.ts"]
    .map((f) => readFileSync(new URL(f, dir), "utf8"))
    .join("\n");
  for (const name of LONG_OPERATION_MUTATIONS) {
    assert.ok(source.includes(`mutationKey: ["${name}"]`), name);
  }
  for (const name of LONG_OPERATION_QUERIES) {
    assert.ok(source.includes(`queryKey: ["${name}"]`), name);
  }
});
