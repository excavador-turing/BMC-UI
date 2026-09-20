#!/usr/bin/env python3
"""How tall is every tab, and does the header still fit in one bar.

The site has had a screen gate since its rework: every page measured at nine
viewports on every pull request, and the front page went from 467 faults to
none because a number was being watched. This interface had no such gate,
which is how Settings reached 3140px -- four screens on a laptop -- and how
the firmware-sources editor came to be rendered on two tabs with nobody
noticing for a release.

Measured against the DEMO build, so no board is needed: `VITE_DEMO=1` swaps
axios's adapter for one that answers from captured fixtures, and a card whose
endpoint the fixtures lack hides itself exactly as it does on an older board.

    npm run screens              # measure and judge
    npm run screens -- --record  # re-record the baseline

TWO HONEST LIMITS, because a gate that is believed to cover more than it does
is worse than no gate.

The fixtures do not include the access, certificate or switch endpoints, so
this UNDERCOUNTS Access and Network by those cards. It still catches the
header, every tab that has fixtures, and any card that grows. Capturing those
endpoints from a board -- the demo's own rule: captured, never written --
closes the gap and is a line in `capture-fixtures.sh`.

And Console is exempt from the height rule. A terminal is meant to be tall.
"""
from __future__ import annotations

import argparse
import asyncio
import http.server
import json
import os
import pathlib
import shutil
import socket
import socketserver
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request

import websockets

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
BASELINE = ROOT / "scripts" / "screens-baseline.json"

# The tabs, by the hash route the demo serves them at.
TABS = [
    "info",
    "nodes",
    "console",
    "network",
    "access",
    "firmware-upgrade",
    "settings",
    "about",
    "flash-node",
    "usb",
]

VIEWPORTS = [("laptop", 1280, 800), ("phone", 390, 844)]

# One bar, logo and tabs and avatar together. 64 is what that costs with room
# to spare; it was 182 before the bar and the strip became one thing.
MAX_HEADER = 64

# A tab may be two screens. Not one -- Settings and Firmware have real content
# and a rule nobody can keep is a rule that gets a baseline entry instead of a
# fix. Two screens means "you scroll once", which is the line between a page
# and a document.
MAX_SCREENS = 2

# Chrome rounds and a border is a pixel. A tab one pixel over is not a tab
# that fails.
SLOP = 4

MEASURE = """
(() => {
  const header = document.querySelector('header');
  const main = document.querySelector('main');
  const cards = [...document.querySelectorAll('main .text-lg.font-bold')]
    .map(e => e.textContent.trim()).filter(Boolean);
  const h = e => e ? Math.round(e.getBoundingClientRect().height) : 0;
  return {
    header: h(header),
    page: document.documentElement.scrollHeight,
    viewport: window.innerHeight,
    hscroll: document.documentElement.scrollWidth > window.innerWidth + 1,
    cards,
  };
})()
"""


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


class Server(threading.Thread):
    """The built demo, served from `dist/`, on a port nobody else has.

    Hash routing means every URL is `index.html`, so there is no SPA fallback
    to get wrong.
    """

    def __init__(self, directory: pathlib.Path, port: int) -> None:
        super().__init__(daemon=True)

        class Handler(http.server.SimpleHTTPRequestHandler):
            def __init__(self, *a, **k):
                super().__init__(*a, directory=str(directory), **k)

            def log_message(self, *a):
                pass

        # Threaded: Chrome opens several connections for one page, and a
        # single-threaded server makes them queue behind each other for long
        # enough to look like a hang.
        class Threaded(socketserver.ThreadingTCPServer):
            allow_reuse_address = True
            daemon_threads = True

        self.httpd = Threaded(("127.0.0.1", port), Handler)

    def run(self) -> None:
        self.httpd.serve_forever()

    def stop(self) -> None:
        self.httpd.shutdown()
        self.httpd.server_close()


class Browser:
    """Chrome over the DevTools protocol, one connection, one tab."""

    def __init__(self, ws) -> None:
        self.ws = ws
        self.n = 0
        self.replies: dict[int, asyncio.Future] = {}
        self.events: dict[tuple[str, str], asyncio.Future] = {}
        self.reader = asyncio.create_task(self._read())

    async def _read(self) -> None:
        try:
            async for raw in self.ws:
                m = json.loads(raw)
                if "id" in m:
                    f = self.replies.pop(m["id"], None)
                    if f and not f.done():
                        f.set_result(m)
                else:
                    f = self.events.pop(
                        (m.get("sessionId", ""), m.get("method", "")), None
                    )
                    if f and not f.done():
                        f.set_result(m)
        except Exception:
            pass

    async def send(self, method, params=None, session=None):
        self.n += 1
        i = self.n
        f = asyncio.get_running_loop().create_future()
        self.replies[i] = f
        p = {"id": i, "method": method, "params": params or {}}
        if session:
            p["sessionId"] = session
        await self.ws.send(json.dumps(p))
        m = await asyncio.wait_for(f, timeout=60)
        if "error" in m:
            raise RuntimeError(f"{method}: {m['error']}")
        return m.get("result", {})

    def expect(self, session, method):
        f = asyncio.get_running_loop().create_future()
        self.events[(session, method)] = f
        return f

    async def tab(self) -> str:
        t = await self.send("Target.createTarget", {"url": "about:blank"})
        a = await self.send(
            "Target.attachToTarget", {"targetId": t["targetId"], "flatten": True}
        )
        s = a["sessionId"]
        await self.send("Page.enable", session=s)
        await self.send("Runtime.enable", session=s)
        return s

    async def goto(self, s: str, url: str) -> None:
        loaded = self.expect(s, "Page.loadEventFired")
        await self.send("Page.navigate", {"url": url}, session=s)
        try:
            await asyncio.wait_for(loaded, timeout=30)
        except asyncio.TimeoutError:
            pass
        await self.js(s, "document.fonts.ready.then(() => true)")

    async def hash_to(self, s: str, route: str) -> None:
        """Move between tabs.

        The demo is hash-routed, so `Page.navigate` to another tab does NOT
        load a document and `Page.loadEventFired` never comes -- every tab
        would sit out the load timeout instead. Setting the hash is what a
        click does anyway.
        """
        await self.js(s, f"location.hash = {json.dumps('#/' + route)}; true")

    async def js(self, s: str, expression: str):
        # Vite's one-time reload after a cold start can land between the
        # navigation and the evaluation. Retrying is cheaper than sleeping
        # long enough that it cannot.
        for attempt in range(3):
            try:
                r = await self.send(
                    "Runtime.evaluate",
                    {
                        "expression": expression,
                        "returnByValue": True,
                        "awaitPromise": True,
                    },
                    session=s,
                )
                return r.get("result", {}).get("value")
            except RuntimeError as e:
                if "navigated or closed" not in str(e) or attempt == 2:
                    raise
                await asyncio.sleep(1.0)


def chrome_binary() -> str:
    for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser"):
        found = shutil.which(name)
        if found:
            return found
    sys.exit("screens: no Chrome on PATH. Install one, or skip this check.")


async def measure(base: str, ws_url: str) -> list[dict]:
    results: list[dict] = []
    async with websockets.connect(ws_url, max_size=40 * 1024 * 1024) as ws:
        browser = Browser(ws)
        session = await browser.tab()
        # The demo seeds its own session, so there is no login to get past.
        print("  loading the demo...", file=sys.stderr, flush=True)
        await browser.goto(session, f"{base}/#/info")
        await asyncio.sleep(1.5)

        for name, width, height in VIEWPORTS:
            await browser.send(
                "Emulation.setDeviceMetricsOverride",
                {
                    "width": width,
                    "height": height,
                    "deviceScaleFactor": 1,
                    "mobile": name == "phone",
                },
                session=session,
            )
            for tab in TABS:
                print(f"  {name} {tab}", file=sys.stderr, flush=True)
                await browser.hash_to(session, tab)
                # Queries settle, skeletons resolve. The fixtures answer after
                # a deliberate 120ms, so this is waiting on the demo's own
                # latency rather than on a guess.
                await asyncio.sleep(1.2)
                m = await browser.js(session, MEASURE)
                if not isinstance(m, dict):
                    sys.exit(f"screens: {tab} at {name} did not measure")
                m.update({"tab": tab, "viewport": name, "width": width})
                results.append(m)
    return results


def faults(results: list[dict]) -> list[tuple[str, str]]:
    """Every fault, as (key, detail).

    The KEY carries no measurement -- `height: settings at laptop`, not the
    pixel count. A baseline holding the number would fail the moment the page
    moved by one pixel in either direction, which is a gate that cries every
    day and gets switched off. The number is in the detail, and in the table
    printed above, where a person reads it.
    """
    out: list[tuple[str, str]] = []
    for m in results:
        where = f"{m['tab']} at {m['viewport']}"
        if m["viewport"] == "laptop" and m["header"] > MAX_HEADER + SLOP:
            out.append(
                (
                    f"header: {where}",
                    f"{m['header']}px, over {MAX_HEADER}. The bar is meant to be one row.",
                )
            )
        if m["tab"] != "console":
            limit = m["viewport_height"] * MAX_SCREENS
            if m["page"] > limit + SLOP:
                out.append(
                    (
                        f"height: {where}",
                        f"{m['page']}px over {limit} ({MAX_SCREENS} screens). "
                        f"Cards: {', '.join(m['cards']) or 'none'}",
                    )
                )
        if m["viewport"] == "phone" and m["hscroll"]:
            out.append(
                (f"hscroll: {where}", "the page is wider than the window.")
            )
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--record",
        action="store_true",
        help="re-record the baseline of faults this tree is allowed to have",
    )
    parser.add_argument("--json", type=pathlib.Path, help="write every measurement here")
    args = parser.parse_args()

    if not (DIST / "index.html").exists():
        sys.exit(
            "screens: no dist/. Build the demo first:\n"
            "    VITE_DEMO=1 npm run build"
        )

    port = free_port()
    server = Server(DIST, port)
    server.start()
    base = f"http://127.0.0.1:{port}"

    debug_port = free_port()
    # A profile directory of this run's own. Chrome enforces a singleton per
    # user-data-dir: a second instance pointed at a directory somebody else
    # holds exits at once and hands its window to the first, so the debugging
    # port never opens and the run waits for a Chrome that is not there.
    profile = pathlib.Path(
        tempfile.mkdtemp(prefix="screens-chrome-", dir=os.environ.get("RUNNER_TEMP"))
    )
    chrome = subprocess.Popen(
        [
            chrome_binary(),
            "--headless=new",
            "--disable-gpu",
            "--no-sandbox",
            "--hide-scrollbars",
            f"--remote-debugging-port={debug_port}",
            f"--user-data-dir={profile}",
            "about:blank",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    try:
        ws_url = None
        for _ in range(60):
            try:
                with urllib.request.urlopen(
                    f"http://127.0.0.1:{debug_port}/json/version", timeout=1
                ) as r:
                    ws_url = json.load(r)["webSocketDebuggerUrl"]
                    break
            except Exception:
                time.sleep(0.5)
        if ws_url is None:
            sys.exit("screens: Chrome never answered on its debugging port")

        results = asyncio.run(measure(base, ws_url))
    finally:
        # In the same block that started it, always. The habit is one habit:
        # a browser left running is what wedged a 116 MB board once.
        chrome.terminate()
        try:
            chrome.wait(timeout=10)
        except subprocess.TimeoutExpired:
            chrome.kill()
        server.stop()
        shutil.rmtree(profile, ignore_errors=True)

    for m in results:
        m["viewport_height"] = next(
            h for name, _, h in VIEWPORTS if name == m["viewport"]
        )
        print(
            f"  {m['tab']:<17} {m['viewport']:<7} header {m['header']:>3}  "
            f"page {m['page']:>5} / {m['viewport_height']}  "
            f"cards {len(m['cards'])}"
        )

    if args.json:
        args.json.write_text(json.dumps(results, indent=2))

    found = faults(results)
    detail = dict(found)
    keys = {key for key, _ in found}

    if args.record:
        BASELINE.write_text(json.dumps(sorted(keys), indent=2) + "\n")
        print(f"\nrecorded {len(keys)} known faults in {BASELINE.name}")
        for key in sorted(keys):
            print(f"  {key} -- {detail[key]}")
        return 0

    known = set(json.loads(BASELINE.read_text())) if BASELINE.exists() else set()
    appeared = sorted(keys - known)
    # Both directions, like the site's. A fault that is fixed and left in the
    # baseline is a hole the next regression walks through.
    gone = sorted(known - keys)

    if gone:
        print("\nthese are in the baseline and no longer happen:")
        for key in gone:
            print(f"  {key}")
        print("Re-record with `npm run screens -- --record`.")

    if appeared:
        print("\nNEW:")
        for key in appeared:
            print(f"  {key} -- {detail[key]}")

    if appeared or gone:
        return 1

    print(f"\nno new faults ({len(known)} known)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
