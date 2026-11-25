#!/usr/bin/env python3
"""The serial console shows its last line, with the cursor, whole.

In Safari the line the cursor was on showed only its top tenth, and the
console could not be scrolled further down to reveal it
(excavador-turing/BMC-Firmware#125). The fit addon sizes the terminal from its
parent's computed height and subtracts only the TERMINAL element's padding, so
a border and padding on the parent were counted as room that was not there: one
row too many was fitted, and the last row ran under the parent's clipped edge.

This opens the console in the demo build, lets the terminal fit itself, and
checks that what it drew fits inside the room its frame leaves it: the bottom
of the rows is not below the bottom of the frame's content box, nor is the
right edge past it, and the terminal is not left short by more than one row.
It runs in Chrome, which has the same box model for this; the cause is the
geometry, not the browser.

    VITE_DEMO=1 npm run build && python3 scripts/console-fit-test.py
"""
from __future__ import annotations

import asyncio
import http.server
import json
import pathlib
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request

import websockets

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class Server(threading.Thread):
    def __init__(self, directory: pathlib.Path, port: int):
        super().__init__(daemon=True)
        handler = type(
            "H",
            (http.server.SimpleHTTPRequestHandler,),
            {
                "__init__": lambda self, *a, **k: http.server.SimpleHTTPRequestHandler.__init__(
                    self, *a, directory=str(directory), **k
                ),
                "log_message": lambda *a: None,
            },
        )
        self.httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)

    def run(self):
        self.httpd.serve_forever()

    def stop(self):
        self.httpd.shutdown()


class Browser:
    def __init__(self, ws):
        self.ws = ws
        self.id = 0
        self.pending: dict[int, asyncio.Future] = {}
        self.reader = asyncio.create_task(self._read())

    async def _read(self):
        async for raw in self.ws:
            msg = json.loads(raw)
            if "id" in msg and msg["id"] in self.pending:
                fut = self.pending.pop(msg["id"])
                if "error" in msg:
                    fut.set_exception(RuntimeError(msg["error"].get("message", "?")))
                else:
                    fut.set_result(msg.get("result", {}))

    async def send(self, method, params=None, session=None):
        self.id += 1
        msg = {"id": self.id, "method": method, "params": params or {}}
        if session:
            msg["sessionId"] = session
        fut = asyncio.get_running_loop().create_future()
        self.pending[self.id] = fut
        await self.ws.send(json.dumps(msg))
        return await asyncio.wait_for(fut, timeout=45)

    async def tab(self, width: int, height: int, mobile: bool = False) -> str:
        t = await self.send("Target.createTarget", {"url": "about:blank"})
        a = await self.send(
            "Target.attachToTarget", {"targetId": t["targetId"], "flatten": True}
        )
        s = a["sessionId"]
        await self.send("Page.enable", session=s)
        await self.send("Runtime.enable", session=s)
        await self.send(
            "Emulation.setDeviceMetricsOverride",
            {"width": width, "height": height, "deviceScaleFactor": 1, "mobile": mobile},
            session=s,
        )
        return s

    async def js(self, s, expression):
        r = await self.send(
            "Runtime.evaluate",
            {"expression": expression, "returnByValue": True, "awaitPromise": True},
            session=s,
        )
        if "exceptionDetails" in r:
            raise RuntimeError(r["exceptionDetails"].get("text", "js threw"))
        return r.get("result", {}).get("value")


def start_chrome():
    debug = free_port()
    profile = pathlib.Path(tempfile.mkdtemp(prefix="consolefit-chrome-"))
    chrome = subprocess.Popen(
        [
            shutil.which("google-chrome") or shutil.which("chromium"),
            "--headless=new",
            "--disable-gpu",
            "--no-sandbox",
            "--hide-scrollbars",
            f"--remote-debugging-port={debug}",
            f"--user-data-dir={profile}",
            "about:blank",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for _ in range(50):
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{debug}/json/version") as r:
                return chrome, profile, json.load(r)["webSocketDebuggerUrl"]
        except Exception:
            time.sleep(0.2)
    chrome.kill()
    sys.exit("chrome never opened its debugging port")



MEASURE = """
(() => {
  const screen = document.querySelector('.xterm-screen');
  const term = document.querySelector('.xterm');
  if (!screen || !term) return null;
  const box = term.parentElement;
  const frame = box.parentElement;
  const cs = getComputedStyle(frame);
  const f = frame.getBoundingClientRect();
  const s = screen.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  const px = (v) => parseFloat(v) || 0;
  const room = {
    top: f.top + px(cs.borderTopWidth) + px(cs.paddingTop),
    bottom: f.bottom - px(cs.borderBottomWidth) - px(cs.paddingBottom),
    left: f.left + px(cs.borderLeftWidth) + px(cs.paddingLeft),
    right: f.right - px(cs.borderRightWidth) - px(cs.paddingRight),
  };
  const rows = document.querySelector('.xterm-rows');
  const rowCount = rows ? rows.children.length : 0;
  return {
    screenTop: s.top, screenBottom: s.bottom, screenRight: s.right,
    screenHeight: s.height,
    boxHeight: b.height,
    room,
    rowCount,
    cell: rowCount ? s.height / rowCount : 0,
  };
})()
"""


async def run(b, s, base, width, faults):
    await b.send("Page.navigate", {"url": f"{base}/#/info"}, session=s)
    await asyncio.sleep(3.0)
    await b.js(s, "location.hash = '#/console'; true")
    m = None
    for _ in range(60):
        await asyncio.sleep(0.25)
        m = await b.js(s, MEASURE)
        if m and m["rowCount"] > 0:
            break
    where = f"console at {width}px"
    if not m or m["rowCount"] == 0:
        faults.append(f"{where}: no terminal was drawn")
        return
    # Let the resize observer's fit settle, then measure again.
    await asyncio.sleep(1.5)
    m = await b.js(s, MEASURE)
    room = m["room"]
    room_h = room["bottom"] - room["top"]
    over = m["screenBottom"] - room["bottom"]
    if over > 0.5:
        faults.append(
            f"{where}: the terminal's rows end {over:.1f}px below the frame's content "
            f"box ({m['rowCount']} rows of {m['cell']:.1f}px in {room_h:.1f}px): "
            "the last line is cut off"
        )
    if m["screenRight"] - room["right"] > 0.5:
        faults.append(f"{where}: the terminal is wider than its frame's content box")
    short = room["bottom"] - m["screenBottom"]
    if short > m["cell"] + 0.5:
        faults.append(f"{where}: the terminal leaves {short:.1f}px unused, more than a row")
    if abs(m["boxHeight"] - room_h) > 1:
        faults.append(
            f"{where}: the element the terminal is opened in is {m['boxHeight']:.1f}px high, "
            f"the room is {room_h:.1f}px"
        )
    if not faults:
        print(
            f"  ok   {where}: {m['rowCount']} rows of {m['cell']:.1f}px fill "
            f"{room_h:.1f}px, nothing below the frame"
        )


async def main_async() -> int:
    if not (DIST / "index.html").exists():
        sys.exit("no dist/: build the demo first\n    VITE_DEMO=1 npm run build")
    port = free_port()
    server = Server(DIST, port)
    server.start()
    base = f"http://127.0.0.1:{port}"
    chrome, profile, ws_url = start_chrome()
    faults: list[str] = []
    try:
        async with websockets.connect(ws_url, max_size=40 * 1024 * 1024) as ws:
            b = Browser(ws)
            for width, height, mobile in ((1280, 900, False), (390, 844, True)):
                s = await b.tab(width, height, mobile)
                await run(b, s, base, width, faults)
    finally:
        chrome.terminate()
        try:
            chrome.wait(timeout=10)
        except subprocess.TimeoutExpired:
            chrome.kill()
        server.stop()
        shutil.rmtree(profile, ignore_errors=True)
    if faults:
        print(f"console-fit-test: {len(faults)} problem(s)", file=sys.stderr)
        for f in faults:
            print(f"  {f}", file=sys.stderr)
        return 1
    print("  the console fits its frame at both widths")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main_async()))
