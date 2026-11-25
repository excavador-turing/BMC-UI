import assert from "node:assert/strict";
import { test } from "node:test";

import {
  NO_TIMEOUT,
  POLL_TIMEOUT_MS,
  READ_TIMEOUT_MS,
  SLOW_CHANGE_TIMEOUT_MS,
  SLOW_READ_TIMEOUT_MS,
  STATE_CHANGE_TIMEOUT_MS,
  isUnanswered,
  limitFor,
} from "./requestTimeout.ts";

const axiosError = (fields) =>
  Object.assign(new Error("axios"), { isAxiosError: true, ...fields });

test("the limits are ordered so each class outlasts the one it contains", () => {
  assert.ok(POLL_TIMEOUT_MS <= READ_TIMEOUT_MS);
  assert.ok(READ_TIMEOUT_MS < STATE_CHANGE_TIMEOUT_MS);
  assert.ok(STATE_CHANGE_TIMEOUT_MS < SLOW_READ_TIMEOUT_MS);
  assert.ok(SLOW_READ_TIMEOUT_MS < SLOW_CHANGE_TIMEOUT_MS);
  assert.equal(NO_TIMEOUT, 0);
});

test("a poll plus its limit is about ten seconds, the banner's budget", () => {
  // The polls run every five seconds at most.
  assert.ok(5_000 + POLL_TIMEOUT_MS <= 10_000);
});

test("a request that asked for nothing gets the limit of its kind", () => {
  assert.equal(limitFor("get", READ_TIMEOUT_MS), READ_TIMEOUT_MS);
  assert.equal(limitFor("GET", READ_TIMEOUT_MS), READ_TIMEOUT_MS);
  assert.equal(limitFor(undefined, READ_TIMEOUT_MS), READ_TIMEOUT_MS);
  for (const method of ["post", "put", "delete", "PATCH"]) {
    assert.equal(limitFor(method, READ_TIMEOUT_MS), STATE_CHANGE_TIMEOUT_MS);
  }
});

test("a limit a request named, or no limit, is kept", () => {
  assert.equal(limitFor("post", NO_TIMEOUT), NO_TIMEOUT);
  assert.equal(
    limitFor("post", SLOW_CHANGE_TIMEOUT_MS),
    SLOW_CHANGE_TIMEOUT_MS
  );
  assert.equal(limitFor("get", POLL_TIMEOUT_MS), POLL_TIMEOUT_MS);
  assert.equal(limitFor("post", POLL_TIMEOUT_MS), POLL_TIMEOUT_MS);
  assert.equal(limitFor("get", undefined), undefined);
});

test("a timeout and a broken connection are the board not answering", () => {
  assert.equal(
    isUnanswered(
      axiosError({
        code: "ECONNABORTED",
        message: "timeout of 8000ms exceeded",
      })
    ),
    true
  );
  assert.equal(isUnanswered(axiosError({ code: "ERR_NETWORK" })), true);
});

test("an answer, even a refusal, is the board being there", () => {
  assert.equal(isUnanswered(axiosError({ response: { status: 409 } })), false);
  assert.equal(isUnanswered(axiosError({ response: { status: 500 } })), false);
});

test("a request this page cancelled is not the board's silence", () => {
  assert.equal(isUnanswered(axiosError({ code: "ERR_CANCELED" })), false);
});

test("an error that is not axios's is not the board's silence either", () => {
  assert.equal(
    isUnanswered(new Error("this daemon has no such endpoint")),
    false
  );
  assert.equal(isUnanswered("timeout"), false);
  assert.equal(isUnanswered(null), false);
  assert.equal(isUnanswered(undefined), false);
});
