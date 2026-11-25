import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_BAUD,
  effectiveBaud,
  GARBLE_MIN_SAMPLE,
  GARBLE_WINDOW,
  garbledShare,
  looksLikeWrongSpeed,
} from "../consoleSpeed.ts";

const BOOT =
  "\x1b[0;32m[  OK  ]\x1b[0m Started Network Time Synchronization.\r\n" +
  "[    1.234567] eth0: Link is Up - 1Gbps/Full\tflow control rx/tx\r\n";

/** What an RK1's 1500000 baud output is when read at 115200: bytes that are
 *  nothing like text, run through the decoder the console uses. */
function garbage(length) {
  let seed = 12345;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    bytes[i] = (seed >> 16) & 0xff;
  }
  return new TextDecoder("utf-8").decode(bytes);
}

test("a node with no stored speed runs at 115200, which is wrong for an RK1", () => {
  assert.equal(effectiveBaud(null), DEFAULT_BAUD);
  assert.equal(effectiveBaud(undefined), 115200);
  assert.equal(effectiveBaud(1500000), 1500000);
});

test("an ordinary boot log, colours and tabs included, is not garbled", () => {
  const log = BOOT.repeat(40);
  assert.equal(garbledShare(log), 0);
  assert.equal(looksLikeWrongSpeed(log), false);
});

test("bytes read at the wrong speed look like the wrong speed", () => {
  const text = garbage(2048);
  assert.ok(garbledShare(text) >= 0.25, String(garbledShare(text)));
  assert.equal(looksLikeWrongSpeed(text), true);
  assert.equal(looksLikeWrongSpeed("�".repeat(200)), true);
});

test("a few stray replacement characters in a healthy log are not the wrong speed", () => {
  const log = BOOT.repeat(20) + "���" + BOOT.repeat(20);
  assert.equal(looksLikeWrongSpeed(log), false);
});

test("too little output says nothing", () => {
  const short = "�".repeat(GARBLE_MIN_SAMPLE - 1);
  assert.equal(looksLikeWrongSpeed(short), false);
  assert.equal(looksLikeWrongSpeed(""), false);
  assert.equal(garbledShare(""), 0);
});

test("only the newest output is judged, so a fixed speed clears the notice", () => {
  const old = "�".repeat(GARBLE_WINDOW);
  assert.equal(looksLikeWrongSpeed(old), true);
  // After the speed is corrected and the node resets, good output pushes the
  // garbage out of the window.
  assert.equal(looksLikeWrongSpeed(old + BOOT.repeat(80)), false);
});
