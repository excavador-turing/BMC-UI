#!/usr/bin/env python3
"""The node picker is a radio group a person can use with one click or a key.

Console, Flash Node and USB each choose one of four modules. That was a
dropdown -- open it, then choose -- and is now a row of four radios. What a
screenshot cannot show, and a markup check would take on trust, is whether it
BEHAVES like one, so this drives the demo build over CDP with real mouse and
key events and checks, on each page:

- it is a `radiogroup` named by its visible label, with four `radio`s and
  exactly one tab stop (the roving tabindex);
- one click on a node chooses it, and a second click on the same node does not
  un-choose it;
- the arrow keys move the choice (and wrap), and Space and Enter choose;
- at a phone's width all four are on one row and nothing overflows sideways;
- `?node=3` on the console still preselects node 3.

    VITE_DEMO=1 npm run build && python3 scripts/node-picker-test.py
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

# route, the data-testid on the group, the label the page puts above it
PAGES = [
    ("console", "console-node"),
    ("flash-node", "flash-node"),
    ("usb", "usb-node"),
]

# What a person sees: the radios of the group, in order, as plain data.
STATE = """
((id) => {
  const g = document.querySelector(`[data-testid="${id}"]`);
  if (!g) return null;
  const radios = [...g.querySelectorAll('[role="radio"]')];
  const r = g.getBoundingClientRect();
  const label = (g.getAttribute('aria-labelledby') || '')
    .split(' ').map((i) => (document.getElementById(i) || {}).textContent || '')
    .join(' ').trim();
  return {
    role: g.getAttribute('role'),
    label,
    texts: radios.map((x) => x.textContent.trim()),
    checked: radios.map((x) => x.getAttribute('aria-checked') === 'true'),
    tabbable: radios.filter((x) => x.tabIndex === 0).length,
    focused: radios.findIndex((x) => x === document.activeElement),
    tops: radios.map((x) => Math.round(x.getBoundingClientRect().top)),
    right: Math.round(r.right),
    hscroll: document.documentElement.scrollWidth > window.innerWidth + 1,
    width: window.innerWidth,
  };
})(%s)
"""

CENTER = """
((id, i) => {
  const g = document.querySelector(`[data-testid="${id}"]`);
  const el = g && g.querySelectorAll('[role="radio"]')[i];
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
})(%s, %d)
"""

KEYS = {
    "ArrowRight": (39, ""),
    "ArrowLeft": (37, ""),
    "ArrowDown": (40, ""),
    "ArrowUp": (38, ""),
    "Enter": (13, "\r"),
    " ": (32, " "),
}


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

    async def key(self, s, name):
        code, text = KEYS[name]
        base = {"key": name, "windowsVirtualKeyCode": code, "code": "Space" if name == " " else name}
        await self.send("Input.dispatchKeyEvent", {"type": "rawKeyDown", **base}, session=s)
        if text:
            await self.send("Input.dispatchKeyEvent", {"type": "char", "text": text, **base}, session=s)
        await self.send("Input.dispatchKeyEvent", {"type": "keyUp", **base}, session=s)


def start_chrome():
    debug = free_port()
    profile = pathlib.Path(tempfile.mkdtemp(prefix="nodepicker-chrome-"))
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


async def goto(b, s, base, route):
    await b.js(s, "location.hash = '#/info'; true")
    await asyncio.sleep(0.6)
    await b.js(s, f"location.hash = {json.dumps('#/' + route)}; true")
    for _ in range(40):
        await asyncio.sleep(0.25)
        if await b.js(s, "!!document.querySelector('[role=radiogroup]')"):
            return
    # fall through: the checks below report the group missing


async def run(b, s, base, width, faults):
    async def state(tid):
        return await b.js(s, STATE % json.dumps(tid))

    def checked(st):
        return st["checked"].index(True) if True in st["checked"] else -1

    await b.send("Page.navigate", {"url": f"{base}/#/info"}, session=s)
    await asyncio.sleep(3.0)

    for route, tid in PAGES:
        where = f"{route} at {width}px"
        await goto(b, s, base, route)
        st = await state(tid)
        if not st:
            faults.append(f"{where}: no node picker found")
            continue
        if st["role"] != "radiogroup":
            faults.append(f"{where}: the group's role is {st['role']!r}, not radiogroup")
        if not st["label"]:
            faults.append(f"{where}: the group has no accessible label")
        if len(st["texts"]) != 4:
            faults.append(f"{where}: {len(st['texts'])} radios, not 4")
            continue
        if st["tabbable"] != 1:
            faults.append(f"{where}: {st['tabbable']} tab stops in the group, not 1")
        if st["hscroll"] or st["right"] > st["width"]:
            faults.append(f"{where}: the picker or page overflows sideways")
        if len(set(st["tops"])) != 1:
            faults.append(f"{where}: the four options are not on one row {st['tops']}")
        print(f"  ok   {where}: radiogroup {st['label']!r} {st['texts']}")

        # One click chooses. Pick a node that is not the current one.
        target = 2 if checked(st) != 2 else 3
        pt = await b.js(s, CENTER % (json.dumps(tid), target))
        await b.click(s, pt["x"], pt["y"])
        await asyncio.sleep(0.3)
        st = await state(tid)
        if checked(st) != target:
            faults.append(f"{where}: one click on node {target + 1} chose {checked(st) + 1}")
        # A second click on the chosen node keeps it chosen.
        await b.click(s, pt["x"], pt["y"])
        await asyncio.sleep(0.3)
        st = await state(tid)
        if checked(st) != target:
            faults.append(f"{where}: a second click un-chose node {target + 1}")
        print(f"  ok   {where}: one click chooses, a second keeps it")

        # Arrow keys move the choice and wrap round.
        await b.js(s, f'document.querySelectorAll(\'[data-testid="{tid}"] [role="radio"]\')[{target}].focus(); true')
        for key, want in (("ArrowRight", (target + 1) % 4), ("ArrowLeft", target), ("ArrowLeft", (target - 1) % 4)):
            await b.key(s, key)
            await asyncio.sleep(0.2)
            st = await state(tid)
            if checked(st) != want or st["focused"] != want:
                faults.append(
                    f"{where}: {key} left choice {checked(st) + 1} / focus {st['focused'] + 1}, "
                    f"wanted node {want + 1}"
                )
        print(f"  ok   {where}: arrow keys move and choose")

        # Space and Enter choose a focused radio that is not yet chosen.
        for key in (" ", "Enter"):
            now = checked(await state(tid))
            other = (now + 2) % 4
            await b.js(s, f'document.querySelectorAll(\'[data-testid="{tid}"] [role="radio"]\')[{other}].focus(); true')
            await b.key(s, key)
            await asyncio.sleep(0.2)
            st = await state(tid)
            if checked(st) != other:
                faults.append(f"{where}: {key!r} on node {other + 1} chose {checked(st) + 1}")
        print(f"  ok   {where}: Space and Enter choose")

    # The console's `?node=` still preselects.
    await b.js(s, "location.hash = '#/info'; true")
    await asyncio.sleep(0.6)
    await b.js(s, "location.hash = '#/console?node=3'; true")
    for _ in range(40):
        await asyncio.sleep(0.25)
        if await b.js(s, "!!document.querySelector('[role=radiogroup]')"):
            break
    st = await state("console-node")
    if not st or checked(st) != 2:
        faults.append(f"console at {width}px: ?node=3 did not preselect node 3")
    else:
        print(f"  ok   console at {width}px: ?node=3 preselects node 3")


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
        print(f"node-picker-test: {len(faults)} problem(s)", file=sys.stderr)
        for f in faults:
            print(f"  {f}", file=sys.stderr)
        return 1
    print(f"  {len(PAGES)} pages, two widths: every picker behaves as a radio group")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main_async()))
