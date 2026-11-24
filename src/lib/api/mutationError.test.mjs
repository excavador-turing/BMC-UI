import assert from "node:assert/strict";
import { test } from "node:test";

import { bmcdMessage } from "./bmcdMessage.ts";
import { reportMutationError } from "./mutationError.ts";

const axiosError = (response) =>
  Object.assign(new Error("Request failed with status code 400"), {
    response,
  });

// A reporter that records what it would have shown.
const recorder = (scope) => {
  const shown = [];
  return {
    shown,
    reporter: {
      toast: (toast) => shown.push(toast),
      t: (key) => `t(${key})`,
      scope,
    },
  };
};

test("bmcdMessage reads the daemon's legacy envelope", () => {
  const e = axiosError({
    status: 400,
    statusText: "Bad Request",
    data: { response: [{ result: "node 5 does not exist" }] },
  });
  assert.equal(bmcdMessage(e), "node 5 does not exist");
});

test("bmcdMessage takes a plain string body as it is", () => {
  const e = axiosError({ status: 500, data: "switch is busy" });
  assert.equal(bmcdMessage(e), "switch is busy");
});

test("bmcdMessage falls back to the status text, then axios's message", () => {
  assert.equal(
    bmcdMessage(
      axiosError({ status: 502, statusText: "Bad Gateway", data: "" })
    ),
    "Bad Gateway"
  );
  assert.equal(bmcdMessage(new Error("Network Error")), "Network Error");
});

test("a failure is toasted once with the board's words and the default title", () => {
  const { shown, reporter } = recorder();
  const e = axiosError({
    status: 409,
    data: { response: [{ result: "a firmware update is staged" }] },
  });
  reportMutationError(e, undefined, reporter);
  assert.deepEqual(shown, [
    {
      title: "t(ui.requestFailed)",
      description: "a firmware update is staged",
      variant: "destructive",
    },
  ]);
});

test("meta.errorTitle names the title", () => {
  const { shown, reporter } = recorder();
  reportMutationError(
    new Error("x"),
    { errorTitle: "info.rebootFailed" },
    reporter
  );
  assert.equal(shown[0].title, "t(info.rebootFailed)");
});

test("in a fleet the title names the board", () => {
  const { shown, reporter } = recorder("rack-2");
  reportMutationError(
    new Error("x"),
    { errorTitle: "nodes.powerFailed" },
    reporter
  );
  assert.equal(shown[0].title, "rack-2: t(nodes.powerFailed)");
});

test("an error the page shows in place is not toasted as well", () => {
  const { shown, reporter } = recorder();
  const meta = {
    errorTitle: "switchConfig.applyFailed",
    shownInPlace: (error) => error.message === "asked on the card",
  };
  reportMutationError(new Error("asked on the card"), meta, reporter);
  assert.equal(shown.length, 0);
  reportMutationError(new Error("anything else"), meta, reporter);
  assert.equal(shown.length, 1);
  assert.equal(shown[0].description, "anything else");
});

test("a thrown non-Error is still reported", () => {
  const { shown, reporter } = recorder();
  reportMutationError("timeout", undefined, reporter);
  assert.equal(shown[0].description, "timeout");
});

const unanswered = (message = "timeout of 15000ms exceeded") =>
  Object.assign(new Error(message), {
    isAxiosError: true,
    code: "ECONNABORTED",
  });

test("a change the board did not answer says it may have been applied", () => {
  const { shown, reporter } = recorder();
  reportMutationError(
    unanswered(),
    { errorTitle: "nodes.powerFailed" },
    reporter
  );
  assert.equal(shown.length, 1);
  assert.equal(shown[0].title, "t(ui.boardDidNotAnswer)");
  assert.equal(shown[0].description, "t(ui.changeMayHaveApplied)");
  assert.equal(shown[0].variant, "destructive");
});

test("that report stays long enough to be read", () => {
  const { shown, reporter } = recorder();
  reportMutationError(unanswered("Network Error"), undefined, reporter);
  assert.ok(shown[0].timeoutMs >= 15_000);
});

test("in a fleet that report names the board too", () => {
  const { shown, reporter } = recorder("rack-2");
  reportMutationError(unanswered(), undefined, reporter);
  assert.equal(shown[0].title, "rack-2: t(ui.boardDidNotAnswer)");
});

test("a refusal is still the board's own words, not a silence", () => {
  const { shown, reporter } = recorder();
  const refused = Object.assign(
    new Error("Request failed with status code 409"),
    {
      isAxiosError: true,
      response: {
        status: 409,
        data: { response: [{ result: "node 2 is off" }] },
      },
    }
  );
  reportMutationError(refused, undefined, reporter);
  assert.equal(shown[0].title, "t(ui.requestFailed)");
  assert.equal(shown[0].description, "node 2 is off");
});

test("an unanswered change the page shows in place is not reported twice", () => {
  const { shown, reporter } = recorder();
  reportMutationError(unanswered(), { shownInPlace: () => true }, reporter);
  assert.equal(shown.length, 0);
});
