#!/usr/bin/env python3
"""Reproduce a browser running an old copy of the interface, and check it recovers.

What happened after the v2.40.0 firmware upgrade: the browser kept the old
index.html (bmcd sends no Cache-Control), so the page asked for chunks named
by the OLD build. The board no longer has them, and answers any path it does
not know with index.html -- 200, text/html. A module import receiving HTML
fails, the lazy route never loads, and the person is left with a broken page
until they clear the browser's cache.

This does it for real, over CDP, against the demo build:

  1. serve the build ("old"), and load it in headless Chrome;
  2. swap the served directory for a rebuild whose chunk names differ ("new"),
     behind an SPA fallback that returns index.html for a missing asset, as a
     board does today -- the page in the browser is now stale;
  3. navigate to a lazy route that has not been loaded yet.

Two scenarios:

  recovers   the new build is whole. The old page's import fails, and the page
             must reload once and render the route from the new build.
  loop guard the new build is missing that route's chunk altogether, so a
             reload cannot help. The page must reload once, not forever, and
             then say so.

The "new" build is the old one with every hashed file renamed and every
reference rewritten, which is what a rebuild does to the names; it is not
rebuilt, so the run takes seconds and needs only a demo build:

    VITE_DEMO=1 npm run build && python3 scripts/stale-chunk-test.py
    # or: npm run stale-chunk-test

Run it against a build from before the fix (--dist) to see it fail.
Needs Chrome and `pip install websockets`, like screens.py.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import http.server
import json
import mimetypes
import pathlib
import re
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

# The page that is open, and the lazy route not yet loaded when the swap happens.
START = "power-control"
TARGET = "cooling"
# Text only the target route shows (info.fanControl).
TARGET_TEXT = "Fan Control"
HASHED = re.compile(r"^(.+)-([A-Za-z0-9_-]{8})\.([A-Za-z0-9]+)$")
TEXT_SUFFIXES = {".js", ".css", ".html"}


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def rehash(src: pathlib.Path, dst: pathlib.Path) -> dict[str, str]:
    """Copy src to dst with every hashed asset renamed. Returns old -> new."""
    shutil.copytree(src, dst)
    renames: dict[str, str] = {}
    for f in sorted((dst / "assets").iterdir()):
        m = HASHED.match(f.name)
        if not m:
            continue
        digest = hashlib.sha256((f.name + "|rebuilt").encode()).hexdigest()[:8]
        renames[f.name] = f"{m.group(1)}-{digest}.{m.group(3)}"
    for f in dst.rglob("*"):
        if f.is_file() and f.suffix in TEXT_SUFFIXES:
            text = f.read_text()
            for old, new in renames.items():
                text = text.replace(old, new)
            f.write_text(text)
    for old, new in renames.items():
        (dst / "assets" / old).rename(dst / "assets" / new)
    return renames


class Board(threading.Thread):
    """Serves one directory, swappable, the way a board serves it today:
    no Cache-Control, and index.html (200) for any path that is not a file."""

    def __init__(self, directory: pathlib.Path, port: int):
        super().__init__(daemon=True)
        self.directory = directory
        board = self

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                path = self.path.split("?")[0].split("#")[0].lstrip("/")
                root = board.directory.resolve()
                f = (root / path).resolve()
                if not path or not f.is_file() or root not in f.parents:
                    f = root / "index.html"
                body = f.read_bytes()
                self.send_response(200)
                self.send_header(
                    "Content-Type", mimetypes.guess_type(f.name)[0] or "text/html"
                )
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                try:
                    self.wfile.write(body)
                except (BrokenPipeError, ConnectionResetError):
                    pass  # the page navigated away mid-response

            def log_message(self, *a):
                pass

        self.httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler)

    def run(self):
        self.httpd.serve_forever()

    def stop(self):
        self.httpd.shutdown()


class Browser:
    def __init__(self, ws):
        self.ws = ws
        self.id = 0
        self.pending: dict[int, asyncio.Future] = {}
        self.listeners = []
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
            elif "method" in msg:
                for fn in self.listeners:
                    fn(msg)

    async def send(self, method, params=None, session=None):
        self.id += 1
        msg = {"id": self.id, "method": method, "params": params or {}}
        if session:
            msg["sessionId"] = session
        fut = asyncio.get_running_loop().create_future()
        self.pending[self.id] = fut
        await self.ws.send(json.dumps(msg))
        return await asyncio.wait_for(fut, timeout=30)

    async def tab(self) -> tuple[str, str]:
        """A tab in its own browser context: its own cache and sessionStorage."""
        ctx = (await self.send("Target.createBrowserContext"))["browserContextId"]
        t = await self.send(
            "Target.createTarget", {"url": "about:blank", "browserContextId": ctx}
        )
        a = await self.send(
            "Target.attachToTarget", {"targetId": t["targetId"], "flatten": True}
        )
        s = a["sessionId"]
        await self.send("Page.enable", session=s)
        await self.send("Runtime.enable", session=s)
        return s, ctx

    async def js(self, s, expression):
        r = await self.send(
            "Runtime.evaluate",
            {"expression": expression, "returnByValue": True, "awaitPromise": True},
            session=s,
        )
        if "exceptionDetails" in r:
            raise RuntimeError(r["exceptionDetails"].get("text", "js threw"))
        return r.get("result", {}).get("value")


STATE = """(() => ({
  text: document.body ? document.body.innerText : '',
  notice: !!document.getElementById('stale-bundle-notice'),
  entry: (document.querySelector('script[type=module][src]') || {}).src || null,
  marker: (() => { try { return sessionStorage.getItem('bmc-ui:stale-bundle-reload'); }
                   catch (e) { return null; } })(),
}))()"""


async def scenario(b, base, board, old, new, *, break_target) -> dict:
    """Load `old`, swap in `new`, go to the lazy route. Returns what happened."""
    s, ctx = await b.tab()
    errors: list[str] = []
    navigations = 0
    html_assets: list[str] = []

    def on_event(msg):
        nonlocal navigations
        if msg.get("sessionId") != s:
            return
        m, p = msg["method"], msg.get("params", {})
        if m == "Page.frameNavigated" and not p["frame"].get("parentId"):
            navigations += 1
        elif m == "Runtime.exceptionThrown":
            d = p["exceptionDetails"]
            errors.append((d.get("exception") or {}).get("description") or d.get("text", "?"))
        elif m == "Runtime.consoleAPICalled" and p["type"] == "error":
            errors.append(" ".join(str(a.get("value", a.get("description", ""))) for a in p["args"]))
        elif m == "Network.responseReceived":
            r = p["response"]
            if "/assets/" in r["url"] and r["mimeType"] == "text/html":
                html_assets.append(r["url"].rsplit("/", 1)[1])

    b.listeners.append(on_event)
    await b.send("Network.enable", session=s)
    try:
        board.directory = old
        await b.send("Page.navigate", {"url": f"{base}/#/{START}"}, session=s)
        for _ in range(60):
            if "Power Control" in (await b.js(s, STATE))["text"]:
                break
            await asyncio.sleep(0.25)
        else:
            return {"setup": f"the old build never rendered /#/{START}"}
        before = await b.js(s, STATE)

        # The board is upgraded under the open page.
        board.directory = new
        navigations = 0
        errors.clear()
        html_assets.clear()
        await b.js(s, f"location.hash = '#/{TARGET}'; true")

        rendered = False
        for _ in range(48):  # up to 12 s
            await asyncio.sleep(0.25)
            try:
                st = await b.js(s, STATE)
            except RuntimeError:
                continue  # mid-navigation
            if TARGET_TEXT in st["text"] or (st["notice"] and navigations >= 1):
                rendered = TARGET_TEXT in st["text"]
                break
        # Long enough for a second reload to show itself, if there is going to be one.
        await asyncio.sleep(3 if not break_target else 4)
        st = await b.js(s, STATE)
        return {
            "rendered": TARGET_TEXT in st["text"],
            "notice": st["notice"],
            "navigations": navigations,
            "entry_before": before["entry"].rsplit("/", 1)[-1],
            "entry_after": (st["entry"] or "").rsplit("/", 1)[-1],
            "marker": st["marker"],
            "errors": errors[:6],
            "html_served_for_assets": sorted(set(html_assets)),
            "text": st["text"].strip().replace("\n", " | ")[:140],
        }
    finally:
        b.listeners.remove(on_event)
        await b.send("Target.disposeBrowserContext", {"browserContextId": ctx})


async def run(args, old, new, new_missing) -> int:
    port, debug = free_port(), free_port()
    board = Board(old, port)
    board.start()
    base = f"http://127.0.0.1:{port}"
    profile = pathlib.Path(tempfile.mkdtemp(prefix="stalechunk-chrome-"))
    chrome = subprocess.Popen(
        [
            shutil.which("google-chrome") or shutil.which("chromium"),
            "--headless=new", "--disable-gpu", "--no-sandbox",
            f"--remote-debugging-port={debug}", f"--user-data-dir={profile}",
            "about:blank",
        ],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    faults: list[str] = []
    try:
        ws_url = None
        for _ in range(50):
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{debug}/json/version") as r:
                    ws_url = json.load(r)["webSocketDebuggerUrl"]
                break
            except Exception:
                time.sleep(0.2)
        if not ws_url:
            sys.exit("chrome never opened its debugging port")
        async with websockets.connect(ws_url, max_size=40 * 1024 * 1024) as ws:
            b = Browser(ws)

            print(f"scenario 1: board upgraded under an open page, new build is whole")
            r = await scenario(b, base, board, old, new, break_target=False)
            print(json.dumps(r, indent=2))
            if "setup" in r:
                faults.append(r["setup"])
            else:
                if not r["rendered"]:
                    faults.append(
                        f"/{TARGET} did not render: the stale page did not recover "
                        f"(notice={r['notice']}, errors={r['errors'][:2]})"
                    )
                if r["navigations"] != 1:
                    faults.append(f"expected exactly 1 reload, saw {r['navigations']} navigations")
                if r["rendered"] and r["entry_after"] == r["entry_before"]:
                    faults.append("the page still runs the old entry script after the reload")

            print(f"\nscenario 2: the new build lacks {TARGET}'s chunk, a reload cannot help")
            r = await scenario(b, base, board, old, new_missing, break_target=True)
            print(json.dumps(r, indent=2))
            if "setup" in r:
                faults.append(r["setup"])
            else:
                if r["navigations"] > 1:
                    faults.append(f"reload loop: {r['navigations']} navigations in 7 s")
                if not r["notice"]:
                    faults.append("no notice said the interface was updated")
                if r["navigations"] != 1:
                    faults.append(f"expected exactly 1 reload before giving up, saw {r['navigations']}")
    finally:
        chrome.terminate()
        try:
            chrome.wait(timeout=10)
        except subprocess.TimeoutExpired:
            chrome.kill()
        board.stop()
        shutil.rmtree(profile, ignore_errors=True)

    print()
    if faults:
        print(f"stale-chunk-test: {len(faults)} problem(s)", file=sys.stderr)
        for f in faults:
            print(f"  {f}", file=sys.stderr)
        return 1
    print("stale-chunk-test: a stale page reloads once and renders the new build; "
          "when that cannot help it stops and says so")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dist", type=pathlib.Path, default=ROOT / "dist",
                    help="a demo build (default: dist/)")
    args = ap.parse_args()
    if not (args.dist / "index.html").exists():
        sys.exit("no demo build: VITE_DEMO=1 npm run build")
    work = pathlib.Path(tempfile.mkdtemp(prefix="stalechunk-"))
    try:
        new = work / "new"
        renames = rehash(args.dist, new)
        target = [n for o, n in renames.items() if o.startswith(f"{TARGET}.lazy-")]
        if len(target) != 1:
            sys.exit(f"expected one {TARGET}.lazy chunk, found {len(target)}")
        # Same names as `new`, minus the target's chunk.
        new_missing = work / "new-missing"
        shutil.copytree(new, new_missing)
        (new_missing / "assets" / target[0]).unlink()
        print(f"old build {args.dist}: {len(renames)} hashed files, all renamed in the new one")
        return asyncio.run(run(args, args.dist, new, new_missing))
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
