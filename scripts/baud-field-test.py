#!/usr/bin/env python3
"""The console speed is a node setting, and the Console page says where to use it.

Each node's speed is edited on Power Control (Edit), read back from the form by
name on Save, and sent through the same node-info call as the node's names. What
a markup check would take on trust is whether the select REALLY offers the ten
rates, shows 115200 as the default for a node with none stored, hands the chosen
value to the form, and -- in the demo, which cannot change anything -- refuses
and says why instead of reporting a save. So this drives the demo build over CDP
with real mouse events and checks, at a desktop and a phone width:

- view mode shows "115200 baud (default)" for all four nodes;
- Edit shows one select per node, set to the default, offering exactly the ten
  rates in order, and nothing overflows sideways;
- choosing 921600 changes the form's value for that node and no other;
- Save in the demo shows the demo's refusal, not "saved", and stays in Edit;
- the Console page names /dev/ttyNodeN with a microcom example and says the
  speed is set in the node's settings.

    VITE_DEMO=1 npm run build && python3 scripts/baud-field-test.py

`BAUD_DIST=<dir>` tests another build and `BAUD_SHOTS=<dir>` writes screenshots.
"""
from __future__ import annotations

import asyncio
import base64
import http.server
import json
import os
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
DIST = pathlib.Path(os.environ.get("BAUD_DIST", ROOT / "dist"))
SHOTS = os.environ.get("BAUD_SHOTS")

RATES = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600, 1000000, 1500000]

VIEW = """
(() => [1, 2, 3, 4].map((n) => {
  const el = document.querySelector(`[data-testid="node-${n}-baud-value"]`);
  return el ? el.textContent.trim() : null;
}))()
"""

EDIT = """
(() => {
  const form = document.querySelector('form');
  return {
    triggers: [1, 2, 3, 4].map((n) => {
      const el = document.querySelector(`[data-testid="node-${n}-baud"]`);
      return el ? el.textContent.trim() : null;
    }),
    values: [1, 2, 3, 4].map((n) => {
      const el = form && form.elements.namedItem(`node-${n}-baud`);
      return el ? el.value : null;
    }),
    hscroll: document.documentElement.scrollWidth > window.innerWidth + 1,
  };
})()
"""

OPTIONS = """
[...document.querySelectorAll('[role="option"]')].map((o) => o.textContent.trim())
"""

CENTER = """
((sel, text) => {
  const els = [...document.querySelectorAll(sel)];
  const el = text ? els.find((e) => e.textContent.trim().startsWith(text)) : els[0];
  if (!el) return null;
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
})(%s, %s)
"""


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

    async def click(self, s, x, y):
        for t in ("mousePressed", "mouseReleased"):
            await self.send(
                "Input.dispatchMouseEvent",
                {"type": t, "x": x, "y": y, "button": "left", "clickCount": 1},
                session=s,
            )

    async def shot(self, s, name):
        if not SHOTS:
            return
        r = await self.send("Page.captureScreenshot", {"format": "png"}, session=s)
        out = pathlib.Path(SHOTS)
        out.mkdir(parents=True, exist_ok=True)
        (out / name).write_bytes(base64.b64decode(r["data"]))


def start_chrome():
    debug = free_port()
    profile = pathlib.Path(tempfile.mkdtemp(prefix="baud-chrome-"))
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


async def goto(b, s, route, ready):
    await b.js(s, "location.hash = '#/info'; true")
    await asyncio.sleep(0.6)
    await b.js(s, f"location.hash = {json.dumps('#/' + route)}; true")
    for _ in range(40):
        await asyncio.sleep(0.25)
        if await b.js(s, ready):
            return True
    return False


async def run(b, s, base, width, faults):
    where = f"power-control at {width}px"
    await b.send("Page.navigate", {"url": f"{base}/#/info"}, session=s)
    await asyncio.sleep(3.0)

    suffix = "" if width > 600 else "-phone"

    if not await goto(b, s, "power-control", "!!document.querySelector('[data-testid=\"nodes-edit\"]')"):
        faults.append(f"{where}: the page never showed its Edit button")
        return

    view = await b.js(s, VIEW)
    if view != ["115200 baud (default)"] * 4:
        faults.append(f"{where}: view mode shows {view}, not 115200 baud (default) x4")
    else:
        print(f"  ok   {where}: view mode shows 115200 baud (default) for all four nodes")
    await b.shot(s, f"nodes-view{suffix}.png")

    pt = await b.js(s, CENTER % (json.dumps('[data-testid="nodes-edit"]'), "null"))
    await b.click(s, pt["x"], pt["y"])
    await asyncio.sleep(0.5)

    st = await b.js(s, EDIT)
    if st["values"] != ["115200"] * 4:
        faults.append(f"{where}: Edit starts at {st['values']}, not 115200 x4")
    if not all(t and t.startswith("115200 baud") for t in st["triggers"]):
        faults.append(f"{where}: the selects show {st['triggers']}")
    if st["hscroll"]:
        faults.append(f"{where}: the page overflows sideways in Edit")
    print(f"  ok   {where}: Edit shows four selects at the default")
    await b.shot(s, f"nodes-edit{suffix}.png")

    # Open node 2's select and read what it offers.
    pt = await b.js(s, CENTER % (json.dumps('[data-testid="node-2-baud"]'), "null"))
    await b.click(s, pt["x"], pt["y"])
    await asyncio.sleep(0.5)
    offered = await b.js(s, OPTIONS)
    nums = [int(o.split()[0]) for o in offered]
    if nums != RATES:
        faults.append(f"{where}: the select offers {nums}, not {RATES}")
    else:
        print(f"  ok   {where}: the select offers the ten rates in order")
    await b.shot(s, f"nodes-select-open{suffix}.png")

    pt = await b.js(s, CENTER % (json.dumps('[role="option"]'), json.dumps("921600")))
    await b.click(s, pt["x"], pt["y"])
    await asyncio.sleep(0.5)
    st = await b.js(s, EDIT)
    if st["values"] != ["115200", "921600", "115200", "115200"]:
        faults.append(f"{where}: after choosing 921600 for node 2 the form says {st['values']}")
    else:
        print(f"  ok   {where}: choosing 921600 changes node 2's value and no other")

    # Save: the demo refuses and says why; it must not report a save.
    pt = await b.js(s, CENTER % (json.dumps('button[type="submit"]'), "null"))
    await b.click(s, pt["x"], pt["y"])
    text = ""
    for _ in range(20):
        await asyncio.sleep(0.25)
        text = await b.js(s, "document.body.innerText")
        if "This is a demo" in text:
            break
    if "This is a demo" not in text:
        faults.append(f"{where}: Save in the demo did not say it is a demo")
    if "Nodes information saved" in text:
        faults.append(f"{where}: Save in the demo claimed to have saved")
    still = await b.js(s, "!!document.querySelector('[data-testid=\"node-1-baud\"]')")
    if not still:
        faults.append(f"{where}: Edit closed after a refused Save")
    else:
        print(f"  ok   {where}: Save in the demo refuses, says why, and stays in Edit")
    await b.shot(s, f"nodes-save-refused{suffix}.png")

    # The Console page, on a fresh load so the refusal's toast is gone.
    where = f"console at {width}px"
    await b.send("Page.navigate", {"url": f"{base}/?fresh=1#/info"}, session=s)
    await asyncio.sleep(3.0)
    if not await goto(b, s, "console", "!!document.querySelector('[data-testid=\"console-local-example\"]')"):
        faults.append(f"{where}: the local-console note never appeared")
        return
    body = await b.js(s, "document.body.innerText")
    example = await b.js(s, "document.querySelector('[data-testid=\"console-local-example\"]').textContent.trim()")
    if example != "microcom -s 115200 /dev/ttyNode1":
        faults.append(f"{where}: the example reads {example!r}")
    for need in ("/dev/ttyNodeN", "shared console", "set in the node's settings"):
        if need not in body:
            faults.append(f"{where}: the note does not say {need!r}")
    if await b.js(s, "document.documentElement.scrollWidth > window.innerWidth + 1"):
        faults.append(f"{where}: the page overflows sideways")
    print(f"  ok   {where}: the note names /dev/ttyNodeN, the example, and where the speed is set")
    await b.js(s, "document.querySelector('[data-testid=\"console-local-example\"]').scrollIntoView({block:'end'}); window.scrollBy(0, 400); true")
    await asyncio.sleep(0.3)
    await b.shot(s, f"console-note{suffix}.png")


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
        print(f"baud-field-test: {len(faults)} problem(s)", file=sys.stderr)
        for f in faults:
            print(f"  {f}", file=sys.stderr)
        return 1
    print("  two widths: the console speed field and the Console note behave")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main_async()))
