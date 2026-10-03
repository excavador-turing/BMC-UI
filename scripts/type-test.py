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

A box that only exists once something is opened -- a sheet, a dialog, a
collapsible, an Edit mode, the "static address" choice -- is a box a person
types into just the same, and is exactly the kind a redesign moves out of
sight. So each route lists the STEPS that open them (`STEPS`, triggered by
`data-testid`s kept on the buttons for this purpose): the route is reloaded,
the step is performed, the new boxes are typed into. A step whose trigger has
gone is a failure, not a skip.

Two guards keep the gate from quietly shrinking:

- `MIN_INPUTS`: fewer typed boxes than this fails the run. The number is the
  real count; raise it when boxes are added, and lower it only in a commit
  that says which box the redesign removed and why.
- The only inputs ever left out are Base UI's hidden Select carriers, and the
  run checks that each excluded one really is one.
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
    "power-control",
    "cooling",
    "network",
    "switch",
    "security",
    "settings",
    "firmware-upgrade",
    "flash-node",
    "usb",
]


# Typed boxes expected in one run. See the docstring before lowering it.
MIN_INPUTS = 44

# What to open, per route, to reach boxes that are not on the page at first.
# Each step is (name, actions); an action is ("click", testid), ("css", selector),
# ("option", regex): click the listbox option whose text matches, or
# ("type", css): leave an edit in the first matching box.
#
# Not reached, because the demo's board cannot offer them: the trusted-proxy
# header box (it needs a pinned client CA) and the switch Apply dialog's
# "confirm within N s" box (the demo refuses the validate call, which leaves
# Apply disabled). Both are outside this gate, and say so here.
STEPS: dict[str, list[tuple[str, list[tuple[str, str]]]]] = {
    "power-control": [("node names (Edit)", [("click", "nodes-edit")])],
    "network": [
        (
            "static address",
            [("click", "address-mode"), ("option", "static")],
        )
    ],
    # The first step leaves an edit in a cell, which is what makes a layout
    # something to apply.
    "switch": [
        (
            "switch editor (Edit)",
            [("click", "switch-edit"), ("type", "main table input")],
        ),
        # Filtering on shows a name box per VLAN in use.
        (
            "VLAN names (filtering on)",
            [("click", "switch-edit"), ("css", 'label[for="switch-filtering"]')],
        ),
    ],
    "security": [
        ("certificate sheet", [("click", "certificate-install")]),
    ],
    "firmware-upgrade": [
        ("upload dialog", [("click", "firmware-upload")]),
        ("sources sheet", [("click", "firmware-sources")]),
    ],
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
  const typeable = (i) =>
    !['checkbox', 'radio', 'file', 'range', 'submit', 'button'].includes(i.type);
  // What the aria-hidden rule leaves out, so the run can check it is only
  // ever a Select's value carrier: tab-index -1, beside a combobox trigger.
  const excluded = [...document.querySelectorAll('input[aria-hidden="true"]')]
    .filter(typeable)
    .map((i) => ({
      name: i.name || i.id || '(unnamed)',
      tabindex: i.getAttribute('tabindex'),
      carrier: !!(i.parentElement &&
        i.parentElement.querySelector('[role="combobox"], [data-slot="select-trigger"]')),
    }));
  const inputs = [...document.querySelectorAll('input, textarea')].filter(
    (i) => typeable(i) && i.getAttribute('aria-hidden') !== 'true'
  );
  // Last first. Typing into a switch cell changes which VLANs exist and so
  // replaces the VLAN-name boxes beneath the table; probed top-down they
  // would be detached by the time their turn came and silently skipped.
  for (const el of inputs.reverse()) {
    if (!visible(el) || el.disabled || el.readOnly) continue;
    const before = el.value;
    const typed = probeFor(el);
    set(el, typed);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const after = el.value;
    out.push({
      name: [el.name, el.getAttribute('aria-label'), el.placeholder, el.id].find((n) => n && !n.startsWith('base-ui-')) || '(unnamed)',
      type: el.type,
      kept: after === typed,
      became: after === typed ? null : after,
      before,
    });
    // Put it back, so one tab's probe does not disturb the next.
    set(el, before);
  }
  return { typed: out.reverse(), excluded };
})()
"""


POINT = """
((kind, key) => {
  let el = null;
  if (kind === 'click') el = document.querySelector(`[data-testid="${key}"]`);
  else if (kind === 'css') el = document.querySelector(key);
  else el = [...document.querySelectorAll('[role="option"]')]
    .find((o) => new RegExp(key, 'i').test(o.textContent || ''));
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
})(%s, %s)
"""


async def press(b, s, kind, key) -> bool:
    if kind == "type":
        for _ in range(25):
            done = await b.js(s, """((css) => {
              const el = document.querySelector(css);
              if (!el) return false;
              const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
              d.set.call(el, 'x1');
              el.dispatchEvent(new Event('input', { bubbles: true }));
              return true;
            })(%s)""" % json.dumps(key))
            if done:
                await asyncio.sleep(0.4)
                return True
            await asyncio.sleep(0.2)
        return False
    """Click like a person does -- Base UI's triggers open on pointer events,
    which `element.click()` does not send. Waits a little for the target."""
    for _ in range(25):
        pt = await b.js(s, POINT % (json.dumps(kind), json.dumps(key)))
        if pt:
            for t in ("mousePressed", "mouseReleased"):
                await b.send(
                    "Input.dispatchMouseEvent",
                    {"type": t, "x": pt["x"], "y": pt["y"], "button": "left", "clickCount": 1},
                    session=s,
                )
            await asyncio.sleep(0.9)
            return True
        await asyncio.sleep(0.2)
    return False


def signature(r) -> str:
    return f"{r['type']}|{r['name']}"


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

            async def visit(route):
                # Away and back: a step's dialog or edit mode lives in the
                # page's state, and leaving the route throws it away.
                await b.js(s, "location.hash = '#/info'; true")
                await asyncio.sleep(0.8)
                await b.js(s, f"location.hash = {json.dumps('#/' + route)}; true")
                await asyncio.sleep(1.6)

            def record(route, where, results):
                nonlocal checked
                for r in results["typed"]:
                    checked += 1
                    per_tab[route] = per_tab.get(route, 0) + 1
                    mark = "ok  " if r["kept"] else "FAIL"
                    print(f"  {mark} {route:17} {r['type']:9} {r['name']}  [{where}]")
                    if not r["kept"]:
                        faults.append(
                            f"{route} [{where}]: {r['name']} ({r['type']}) did not keep "
                            f"what was typed; it reverted to {r['became']!r}"
                        )
                for x in results["excluded"]:
                    excluded.append(f"{route} [{where}]: {x['name']}")
                    if x["tabindex"] != "-1" or not x["carrier"]:
                        faults.append(
                            f"{route} [{where}]: aria-hidden input {x['name']!r} was "
                            "left out but is not a Select's value carrier"
                        )

            per_tab: dict[str, int] = {}
            excluded: list[str] = []
            for route in ROUTES:
                await visit(route)
                try:
                    base_res = await b.js(s, PROBE)
                except RuntimeError as e:
                    faults.append(f"{route}: the probe threw: {e}")
                    continue
                record(route, "page", base_res)
                have: dict[str, int] = {}
                for r in base_res["typed"]:
                    have[signature(r)] = have.get(signature(r), 0) + 1

                for name, actions in STEPS.get(route, []):
                    await visit(route)
                    opened = True
                    for kind, key in actions:
                        if not await press(b, s, kind, key):
                            faults.append(
                                f"{route} [{name}]: could not find {kind} {key!r} -- "
                                "the boxes behind it are no longer reached"
                            )
                            opened = False
                            break
                    if not opened:
                        continue
                    await asyncio.sleep(0.6)
                    try:
                        res = await b.js(s, PROBE)
                    except RuntimeError as e:
                        faults.append(f"{route} [{name}]: the probe threw: {e}")
                        continue
                    if args.debug:
                        print("   debug", route, name, [signature(r) for r in res["typed"]][-4:])
                    # Only what this step added: the page behind a dialog is
                    # still there, and has been counted already.
                    seen = dict(have)
                    fresh = []
                    for r in res["typed"]:
                        sig = signature(r)
                        if seen.get(sig, 0) > 0:
                            seen[sig] -= 1
                        else:
                            fresh.append(r)
                    if not fresh:
                        faults.append(
                            f"{route} [{name}]: opened, but no new text box appeared"
                        )
                    record(route, name, {"typed": fresh, "excluded": res["excluded"]})
                    # Steps overlap -- each is the page plus one more state --
                    # so what has been counted is the most of each box seen.
                    now: dict[str, int] = {}
                    for r in res["typed"]:
                        now[signature(r)] = now.get(signature(r), 0) + 1
                    for sig, n in now.items():
                        have[sig] = max(have.get(sig, 0), n)
    finally:
        chrome.terminate()
        try:
            chrome.wait(timeout=10)
        except subprocess.TimeoutExpired:
            chrome.kill()
        server.stop()
        shutil.rmtree(profile, ignore_errors=True)

    print()
    for route in ROUTES:
        print(f"  {route:17} {per_tab.get(route, 0):3}")
    print(f"  Select carriers left out: {len(excluded)}"
          + (f" ({', '.join(sorted(set(e.split(': ')[1] for e in excluded)))})" if excluded else ""))
    if checked < MIN_INPUTS:
        faults.append(
            f"only {checked} text boxes were typed into; the floor is {MIN_INPUTS}. "
            "A box has moved out of reach of this gate (a dialog, a collapsible) "
            "-- add a step for it in STEPS."
        )
    if checked == 0:
        print("type-test: no text inputs found at all -- the demo did not render",
              file=sys.stderr)
        return 1
    if faults:
        print(f"type-test: {len(faults)} problem(s) across {checked} inputs typed",
              file=sys.stderr)
        for f in faults:
            print(f"  {f}", file=sys.stderr)
        return 1
    print(f"  {checked} text inputs across {len(ROUTES)} tabs, every one kept what was typed "
          f"(floor {MIN_INPUTS})")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--debug", action="store_true", help="print what each step saw")
    return asyncio.run(main_async(ap.parse_args()))


if __name__ == "__main__":
    sys.exit(main())
