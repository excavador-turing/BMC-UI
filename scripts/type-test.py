#!/usr/bin/env python3
"""Type into every text box the demo shows, and check the value took.

A controlled React input given `value` but no `onChange` is READ-ONLY: every
keystroke is reverted on the next render, silently. That is what issue #48
reported — "password setting form does not accept typing in any of the text
widgets" — and nothing in the build, the lint or the screens gate could see
it, because the markup is perfect and the page renders.

So this drives the demo build over CDP, finds every visible text input, sets
a value the way a person's keystroke does (native setter + an `input` event,
which is what React listens for), waits a frame, and reads the value back.
An input that does not keep what was typed is reported.

    VITE_DEMO=1 npm run build && python3 scripts/type-test.py
"""
from __future__ import annotations

import argparse
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

import websockets

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
WIDTH, HEIGHT = 1280, 900

# Every tab the demo can reach, by hash route.
ROUTES = [
    "info",
    "nodes",
    "network",
    "security",
    "settings",
    "firmware-upgrade",
    "flash-node",
    "usb",
]


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

    async def tab(self) -> str:
        t = await self.send("Target.createTarget", {"url": "about:blank"})
        a = await self.send(
            "Target.attachToTarget", {"targetId": t["targetId"], "flatten": True}
        )
        s = a["sessionId"]
        await self.send("Page.enable", session=s)
        await self.send("Runtime.enable", session=s)
        await self.send(
            "Emulation.setDeviceMetricsOverride",
            {"width": WIDTH, "height": HEIGHT, "deviceScaleFactor": 1, "mobile": False},
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


# Typed the way a person types: React listens for `input` on the native
# element, so the value is set through the prototype's setter and the event
# dispatched. Setting `.value` alone is invisible to React.
PROBE = r"""
(async () => {
  // Type something the input can actually hold. A `number` box refuses a
  // non-numeric string outright -- the browser stores "" -- and reporting
  // that as "refused typing" is a false alarm, which is how a gate gets
  // switched off.
  const probeFor = (el) => {
    if (el.type === 'number') return '42';
    if (el.type === 'email') return 'probe@example.test';
    if (el.type === 'url') return 'https://example.test/probe';
    return 'Probe-Value-42';
  };
  const set = (el, v) => {
    const d = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(el), 'value');
    d.set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const out = [];
  // `aria-hidden` inputs are not boxes a person types into: Base UI's Select
  // keeps one beside its trigger, out of the tab order, only to carry the
  // chosen value into a form.
  const inputs = [...document.querySelectorAll('input')].filter(
    (i) =>
      !['checkbox', 'radio', 'file', 'range', 'submit', 'button'].includes(i.type) &&
      i.getAttribute('aria-hidden') !== 'true'
  );
  for (const el of inputs) {
    if (!visible(el) || el.disabled || el.readOnly) continue;
    const before = el.value;
    const typed = probeFor(el);
    set(el, typed);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const after = el.value;
    out.push({
      name: el.name || el.id || el.placeholder || '(unnamed)',
      type: el.type,
      kept: after === typed,
      became: after === typed ? null : after,
      before,
    });
    // Put it back, so one tab's probe does not disturb the next.
    set(el, before);
  }
  return out;
})()
"""


async def main_async(args) -> int:
    if not (DIST / "index.html").exists():
        sys.exit("no dist/: build the demo first\n"
                 "    VITE_DEMO=1 npm run build")

    port = free_port()
    server = Server(DIST, port)
    server.start()
    base = f"http://127.0.0.1:{port}"

    debug = free_port()
    profile = pathlib.Path(tempfile.mkdtemp(prefix="typetest-chrome-"))
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

    ws_url = None
    for _ in range(50):
        try:
            import urllib.request

            with urllib.request.urlopen(f"http://127.0.0.1:{debug}/json/version") as r:
                ws_url = json.load(r)["webSocketDebuggerUrl"]
            break
        except Exception:
            time.sleep(0.2)
    if not ws_url:
        chrome.kill()
        server.stop()
        sys.exit("chrome never opened its debugging port")

    faults: list[str] = []
    checked = 0
    try:
        async with websockets.connect(ws_url, max_size=40 * 1024 * 1024) as ws:
            b = Browser(ws)
            s = await b.tab()
            await b.send("Page.navigate", {"url": f"{base}/#/info"}, session=s)
            await asyncio.sleep(3.0)

            for route in ROUTES:
                await b.js(s, f"location.hash = {json.dumps('#/' + route)}; true")
                await asyncio.sleep(1.6)
                try:
                    results = await b.js(s, PROBE)
                except RuntimeError as e:
                    faults.append(f"{route}: the probe threw: {e}")
                    continue
                for r in results or []:
                    checked += 1
                    mark = "ok  " if r["kept"] else "FAIL"
                    print(f"  {mark} {route:17} {r['type']:9} {r['name']}")
                    if not r["kept"]:
                        faults.append(
                            f"{route}: {r['name']} ({r['type']}) did not keep what was "
                            f"typed; it reverted to {r['became']!r}"
                        )
    finally:
        chrome.terminate()
        try:
            chrome.wait(timeout=10)
        except subprocess.TimeoutExpired:
            chrome.kill()
        server.stop()
        shutil.rmtree(profile, ignore_errors=True)

    print()
    if checked == 0:
        print("type-test: no text inputs found at all -- the demo did not render",
              file=sys.stderr)
        return 1
    if faults:
        print(f"type-test: {len(faults)} of {checked} inputs refused typing",
              file=sys.stderr)
        for f in faults:
            print(f"  {f}", file=sys.stderr)
        return 1
    print(f"  {checked} text inputs across {len(ROUTES)} tabs, every one kept what was typed")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.parse_args()
    return asyncio.run(main_async(ap.parse_args()))


if __name__ == "__main__":
    sys.exit(main())
