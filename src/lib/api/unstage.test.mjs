import assert from "node:assert/strict";
import { test } from "node:test";

import { sendStateChange } from "./stateChange.ts";
import { UNSTAGE_TIMEOUT_MS, unstageRequest } from "./unstage.ts";

const failure = (status) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data: "" },
  });

test("the cancel is a state change: firmware_unstage, as POST, with a timeout", async () => {
  const asked = [];
  const api = {
    request: async (config) => {
      asked.push(config);
      return { status: 200, data: { response: [{ result: {} }] } };
    },
  };

  await sendStateChange(api, "/bmc", unstageRequest());

  assert.equal(asked.length, 1);
  assert.equal(asked[0].method, "POST");
  assert.equal(asked[0].url, "/bmc");
  assert.deepEqual(asked[0].params, {
    opt: "set",
    type: "firmware_unstage",
  });
  assert.equal(asked[0].timeout, UNSTAGE_TIMEOUT_MS);
});

test("the timeout is short enough that a dead board is reported in seconds", () => {
  assert.ok(UNSTAGE_TIMEOUT_MS >= 5_000);
  assert.ok(UNSTAGE_TIMEOUT_MS <= 30_000);
});

test("a board that does not have the cancel answers 400, which is shown, not retried", async () => {
  // Only a 405 is retried as GET, and a GET would be refused by a current
  // daemon in any case. An old daemon answers "Invalid `type` parameter".
  const refusal = failure(400);
  let calls = 0;
  const api = {
    request: async () => {
      calls += 1;
      throw refusal;
    },
  };

  await assert.rejects(sendStateChange(api, "/bmc", unstageRequest()), refusal);
  assert.equal(calls, 1);
});
