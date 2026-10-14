import assert from "node:assert/strict";
import { test } from "node:test";

import { bmcdMessage } from "./bmcdMessage.ts";
import { handleParams } from "./flashParams.ts";

test("a card source sends sdcard=1 and file, and no length", () => {
  const p = handleParams({
    type: "flash",
    node: 2,
    url: "images/ubuntu.img.xz",
    sdcard: true,
    skipCRC: false,
  });
  assert.equal(p.sdcard, 1);
  assert.equal(p.file, "images/ubuntu.img.xz");
  assert.equal(p.node, 2);
  assert.ok(!("length" in p));
});

test("an unticked Skip CRC sends no skip_crc key at all", () => {
  const p = handleParams({ type: "flash", url: "x.img", skipCRC: false });
  assert.ok(!("skip_crc" in p));
});

test("a ticked Skip CRC sends skip_crc=1", () => {
  const p = handleParams({ type: "flash", url: "x.img", skipCRC: true });
  assert.equal(p.skip_crc, 1);
});

test("an http URL is not marked as a card path", () => {
  const p = handleParams({ type: "flash", url: "http://h/x.img" });
  assert.ok(!("sdcard" in p));
  assert.ok(!("length" in p));
});

test("an upload sends the name and length", () => {
  const p = handleParams({
    type: "flash",
    file: { name: "x.img", size: 12 },
    skipCRC: false,
  });
  assert.equal(p.file, "x.img");
  assert.equal(p.length, 12);
  assert.ok(!("sdcard" in p));
});

test("bmcd's refusal envelope is read as its message, not shown as JSON", () => {
  const err = Object.assign(new Error("Request failed with status code 400"), {
    response: {
      statusText: "Bad Request",
      data: { response: [{ result: "no SD card inserted" }] },
    },
  });
  assert.equal(bmcdMessage(err), "no SD card inserted");
  err.response.data = "";
  assert.equal(bmcdMessage(err), "Bad Request");
});
