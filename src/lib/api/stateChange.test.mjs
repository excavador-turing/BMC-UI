import assert from "node:assert/strict";
import { test } from "node:test";

import { isBackupArchive } from "./backupArchive.ts";
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

// The backup: a board older than the one that refuses state changes on GET
// does not route POST /api/bmc/backup (the route is GET-only, so it does not
// match), and the interface's catch-all answers 200 with index.html.
const answer = (status, type, body) => ({
  status,
  headers: { "content-type": type },
  data: new Blob([body], { type }),
});
const html = () => answer(200, "text/html", "<!doctype html><html></html>");
const archive = () =>
  answer(
    200,
    "application/gzip",
    new Uint8Array([0x1f, 0x8b, 0x08, 0x00, 0x01, 0x02])
  );

const boardAnswering = (...answers) => {
  const asked = [];
  return {
    asked,
    request: async (config) => {
      asked.push(config);
      const next = answers.shift();
      if (next instanceof Error) throw next;
      return next;
    },
  };
};

test("an old board answers a POST of the backup with its page: the GET is sent", async () => {
  const api = boardAnswering(html(), archive());
  const response = await sendStateChange(
    api,
    "/bmc/backup",
    { responseType: "blob" },
    isBackupArchive
  );
  assert.deepEqual(
    api.asked.map((c) => c.method),
    ["POST", "GET"]
  );
  assert.equal(await isBackupArchive(response), true);
});

test("a board that sends the archive on POST is asked once", async () => {
  const api = boardAnswering(archive());
  const response = await sendStateChange(
    api,
    "/bmc/backup",
    { responseType: "blob" },
    isBackupArchive
  );
  assert.equal(api.asked.length, 1);
  assert.equal(api.asked[0].method, "POST");
  assert.equal(await isBackupArchive(response), true);
});

test("a 405 on the backup still falls back to GET", async () => {
  const api = boardAnswering(failure(405), archive());
  const response = await sendStateChange(
    api,
    "/bmc/backup",
    { responseType: "blob" },
    isBackupArchive
  );
  assert.deepEqual(
    api.asked.map((c) => c.method),
    ["POST", "GET"]
  );
  assert.equal(await isBackupArchive(response), true);
});

test("a backup answer that is a page twice is returned, and is not an archive", async () => {
  const api = boardAnswering(html(), html());
  const response = await sendStateChange(
    api,
    "/bmc/backup",
    { responseType: "blob" },
    isBackupArchive
  );
  assert.equal(api.asked.length, 2);
  assert.equal(await isBackupArchive(response), false);
});

test("an error from the board on the backup is not retried", async () => {
  const api = boardAnswering(failure(500));
  await assert.rejects(
    sendStateChange(api, "/bmc/backup", {}, isBackupArchive),
    (e) => e.response.status === 500
  );
  assert.equal(api.asked.length, 1);
});

test("what counts as an archive: gzip bytes, not HTML, a 2xx status", async () => {
  assert.equal(await isBackupArchive(archive()), true);
  assert.equal(await isBackupArchive(html()), false);
  // An HTML content type is refused even if the bytes look right.
  assert.equal(
    await isBackupArchive({
      status: 200,
      headers: { "content-type": "text/html" },
      data: new Blob([new Uint8Array([0x1f, 0x8b])]),
    }),
    false
  );
  // No content type at all, gzip bytes: the bytes decide.
  assert.equal(
    await isBackupArchive({
      status: 200,
      headers: {},
      data: new Blob([new Uint8Array([0x1f, 0x8b, 0x08])]),
    }),
    true
  );
  // Not gzip bytes, not HTML type: octet-stream text is not an archive.
  assert.equal(
    await isBackupArchive({
      status: 200,
      headers: { "content-type": "application/octet-stream" },
      data: new Blob(["not an archive"]),
    }),
    false
  );
  assert.equal(await isBackupArchive({ ...archive(), status: 404 }), false);
  assert.equal(
    await isBackupArchive({ status: 200, headers: {}, data: undefined }),
    false
  );
});
