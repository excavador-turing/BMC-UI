import assert from "node:assert/strict";
import { test } from "node:test";

import { revokeAndClear } from "./logout.ts";
import { sendStateChange } from "./stateChange.ts";

const failure = (status) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data: "" },
  });

// An axios stand-in that answers each request from a list, in order, and
// records what was asked.
const board = (...answers) => {
  const asked = [];
  return {
    asked,
    request: async (config) => {
      asked.push(config);
      const answer = answers.shift();
      if (answer instanceof Error) throw answer;
      return { status: 200, data: answer };
    },
  };
};

const params = { opt: "set", type: "power", node1: "0" };

test("a state change goes as POST with its query string", async () => {
  const api = board("ok");
  const response = await sendStateChange(api, "/bmc", { params });
  assert.equal(response.data, "ok");
  assert.equal(api.asked.length, 1);
  assert.equal(api.asked[0].method, "POST");
  assert.equal(api.asked[0].url, "/bmc");
  assert.deepEqual(api.asked[0].params, params);
});

test("a 405 from an older board is retried once, identically, as GET", async () => {
  const api = board(failure(405), "ok");
  const response = await sendStateChange(api, "/bmc", {
    params,
    responseType: "blob",
  });
  assert.equal(response.data, "ok");
  assert.deepEqual(
    api.asked.map((c) => c.method),
    ["POST", "GET"]
  );
  const { method: _post, ...first } = api.asked[0];
  const { method: _get, ...second } = api.asked[1];
  assert.deepEqual(second, first);
});

test("a 405 on the GET as well is the answer; there is no third try", async () => {
  const api = board(failure(405), failure(405));
  await assert.rejects(sendStateChange(api, "/bmc", { params }), (e) => {
    assert.equal(e.response.status, 405);
    return true;
  });
  assert.equal(api.asked.length, 2);
});

for (const status of [400, 401, 403, 404, 409, 500]) {
  test(`a ${status} is the board's answer and is not retried`, async () => {
    const api = board(failure(status));
    await assert.rejects(sendStateChange(api, "/bmc", { params }), (e) => {
      assert.equal(e.response.status, status);
      return true;
    });
    assert.equal(api.asked.length, 1);
  });
}

test("a network error is not retried", async () => {
  const api = board(new Error("Network Error"));
  await assert.rejects(sendStateChange(api, "/bmc", { params }), {
    message: "Network Error",
  });
  assert.equal(api.asked.length, 1);
});

test("logout revokes the token with it as Bearer, then clears", async () => {
  const calls = [];
  await revokeAndClear(
    "abc",
    "/api",
    async (url, config) => calls.push(["post", url, config.headers]),
    () => calls.push(["clear"])
  );
  assert.deepEqual(calls, [
    ["post", "/api/bmc/logout", { Authorization: "Bearer abc" }],
    ["clear"],
  ]);
});

for (const [what, error] of [
  ["a 404 (no logout route)", failure(404)],
  ["a 405 (an older board)", failure(405)],
  ["a network error", new Error("Network Error")],
]) {
  test(`logout clears the session after ${what}`, async () => {
    let cleared = false;
    await revokeAndClear(
      "abc",
      "/api",
      async () => {
        throw error;
      },
      () => {
        cleared = true;
      }
    );
    assert.equal(cleared, true);
  });
}

test("logout with no token asks nothing of the board and still clears", async () => {
  let posted = false;
  let cleared = false;
  await revokeAndClear(
    null,
    "/api",
    async () => {
      posted = true;
    },
    () => {
      cleared = true;
    }
  );
  assert.equal(posted, false);
  assert.equal(cleared, true);
});
