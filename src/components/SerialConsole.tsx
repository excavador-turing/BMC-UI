import "@xterm/xterm/css/xterm.css";

import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import InfoNote from "@/components/InfoNote";
import { Button } from "@/components/ui/button";
import { useApiBase } from "@/hooks/useApiBase";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

/**
 * What the socket is doing, as four states a reader can act on.
 *
 * A terminal that has gone quiet is ambiguous -- a module can be silent for
 * hours and look exactly like a socket that closed under it. So the state is
 * rendered beside the terminal at all times rather than inferred from the
 * absence of output.
 *
 * `closed` and `failed` are kept apart deliberately. `closed` is a socket
 * that opened and then ended: the daemon restarted, the heartbeat lapsed, the
 * network went away. `failed` is a socket that never opened at all, which on
 * this endpoint almost always means the handshake was rejected.
 */
type ConnectionState = "connecting" | "open" | "closed" | "failed";

/**
 * The session token goes into a WebSocket subprotocol name, and subprotocol
 * names are RFC 6455 tokens -- a restricted character set the browser
 * validates before it sends anything. bmcd's session id is 64 characters of
 * `[A-Za-z0-9]`, which is well inside that, but a token read back from
 * storage is not something this code controls: a stray quote or space would
 * make `new WebSocket(...)` throw a SyntaxError rather than fail a
 * connection, and a thrown constructor inside an effect takes the page down
 * instead of showing a state. Checked first, and reported as a failure.
 */
const TOKEN_PATTERN = /^[A-Za-z0-9]+$/;

/**
 * The terminal draws its own text, so it cannot inherit the page's font
 * stack: it needs a monospace face and this fork ships only Inter. A system
 * stack is the whole answer -- shipping a terminal webfont would add a
 * seventh `.woff2` to a firmware image that is already 78 % of its slot, to
 * render characters every platform can draw from a font it already has.
 */
const MONOSPACE =
  'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

/** Terminal colours for the light theme, taken from the page's own palette. */
const LIGHT_THEME = {
  background: "#ffffff",
  foreground: "#171717",
  cursor: "#171717",
  cursorAccent: "#ffffff",
  selectionBackground: "#d4d4d4",
};

/** The same, for dark: `bg-neutral-900` on `text-neutral-100`. */
const DARK_THEME = {
  background: "#171717",
  foreground: "#f5f5f5",
  cursor: "#f5f5f5",
  cursorAccent: "#171717",
  selectionBackground: "#404040",
};

/**
 * The daemon's UART ring buffer, as the REST endpoint returns it.
 *
 * Two things about this endpoint are unlike every other one here. It answers
 * under the key `uart` rather than `result`, and reading is idempotent -- the
 * handler copies the buffer (`Bytes::copy_from_slice`) rather than draining
 * it, so asking twice is free and asking does not rob the websocket of
 * anything. Both were checked against a board before this was written.
 *
 * `node` is 0-based here, the same as the websocket's query parameter, so the
 * two cannot drift apart.
 */
interface UartResponse {
  response: [{ uart: string }];
}

/** How a close event arrived, kept unrendered so it survives a language switch. */
interface CloseInfo {
  code: number;
  reason: string;
}

/**
 * One module's serial console.
 *
 * The daemon exposes the UART as a WebSocket at
 * `/api/bmc/serial/ws?node=<0..3>`, authenticated by a second subprotocol
 * entry -- `bmcd.bearer.<session token>` -- because a browser cannot put an
 * `Authorization` header on a WebSocket handshake. The first entry has to be
 * a plain name (`bmcd.serial.v1`): the server selects the first offered entry
 * that is not a bearer, and a handshake with nothing to select is one the
 * browser rejects.
 *
 * Server to client is raw UART bytes in binary frames, so they go to the
 * terminal untouched. Client to server is whatever the terminal produced,
 * forwarded verbatim with no line ending appended -- which is the whole
 * reason this exists rather than the REST endpoint documented below it:
 * Ctrl-C, tab completion and the arrow keys are bytes, and a writer that
 * appends CRLF cannot send them.
 *
 * The panel is mounted with `key={node}` by the route, so selecting another
 * module unmounts this one: the terminal is disposed and the socket closed
 * together, and nothing from the old node can land in the new node's buffer.
 */
export default function SerialConsole({ node }: { node: number }) {
  const { t } = useTranslation();
  const { token } = useAuth();
  // Where this board's API lives. `/api` on the board's own interface;
  // `/boards/<id>/api` when the fleet is rendering this against one board
  // through the gateway. Hardcoding the former is what used to make the
  // console the one tab a fleet could not have.
  const { base } = useApiBase();
  const { resolvedTheme } = useTheme();

  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  const [state, setState] = useState<ConnectionState>("connecting");
  const [closeInfo, setCloseInfo] = useState<CloseInfo | null>(null);
  const [protocol, setProtocol] = useState<string | null>(null);

  // Bumped by the reconnect button. It is a dependency of the socket effect
  // and of nothing else, so a reconnect tears down the socket and builds a
  // new one while the terminal -- and everything already scrolled into it --
  // stays exactly where it is.
  const [generation, setGeneration] = useState(0);

  const usable = token !== null && TOKEN_PATTERN.test(token);
  const dark = resolvedTheme === "dark";

  // With no usable token there is no socket to have a state, so the panel's
  // state is derived rather than stored. Writing "failed" into state from
  // the effect would be a render triggering a render, which is what
  // `react-hooks/set-state-in-effect` is there to catch; every other
  // transition below is written from a socket callback or a click, which is
  // where a state change belongs.
  const shown: ConnectionState = usable ? state : "failed";

  /**
   * Write the daemon's UART ring buffer into the terminal.
   *
   * `fetch` rather than the shared axios hook. Not because the hook is
   * unstable any more -- it is memoised now -- but because this path does not
   * want its 401-to-logout interceptor: a token the daemon rejects fails the
   * websocket too, and that is the failure the panel already renders.
   *
   * Both this and the socket below take their prefix from `useApiBase`, so
   * the same component serves a board directly and a board behind the fleet's
   * per-board route.
   *
   * Best-effort on purpose. A module whose reader has not started answers with
   * an error, and a console that refused to open because there was no
   * scrollback to show would be worse than one that opens empty.
   */
  const replay = useCallback(async () => {
    if (!usable) return;
    try {
      const response = await fetch(
        `${base}/bmc?opt=get&type=uart&node=${node}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) return;
      const body = (await response.json()) as UartResponse;
      const text = body.response[0]?.uart ?? "";
      // Re-read the ref: the await is long enough for the node to have changed
      // under us, which unmounts this terminal.
      if (text !== "") terminalRef.current?.write(text);
    } catch {
      // Nothing to show is not an error worth surfacing.
    }
  }, [base, node, token, usable]);

  // The terminal, created once and disposed on unmount. Deliberately not
  // keyed on the node: this component is what gets replaced when the node
  // changes, so a terminal that outlived a node switch would be a bug.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: MONOSPACE,
      fontSize: 13,
      // A module's boot is a few hundred lines and the daemon holds only the
      // last 16 KiB, so scrollback here is the only place a full boot can be
      // read back.
      scrollback: 5000,
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(container);

    terminalRef.current = terminal;
    fitRef.current = fit;

    // The first fit has to wait for a size: `open()` measures a cell, and a
    // container that has not been laid out yet measures zero and proposes
    // nothing. The observer fires once on observe, which is that first fit,
    // and again on every later resize.
    const observer = new ResizeObserver(() => {
      fit.fit();
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      terminalRef.current = null;
      fitRef.current = null;
      terminal.dispose();
    };
  }, []);

  // Theme changes are an option write, not a rebuild: re-creating the
  // terminal to change its colours would throw away the scrollback.
  useEffect(() => {
    const terminal = terminalRef.current;
    if (terminal) {
      terminal.options.theme = dark ? DARK_THEME : LIGHT_THEME;
    }
  }, [dark]);

  // The socket. Runs after the effect above, so the terminal it writes into
  // already exists; a token that cannot be put in a subprotocol name means
  // there is nothing to connect with and the panel renders `failed` instead.
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal || !usable) return;

    // The socket is built after an await, so cleanup can run before it exists.
    // `cancelled` covers that window -- the effect was torn down mid-replay
    // and no socket should be opened at all -- while the `socket` null check
    // in the cleanup covers the other order.
    let cancelled = false;
    let socket: WebSocket | null = null;
    let input: { dispose: () => void } | null = null;

    const attach = () => {
      // Same origin as the page, so the scheme follows the page's: the BMC
      // serves this over TLS, a `vite dev` proxy does not.
      const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(
        `${scheme}//${window.location.host}${base}/bmc/serial/ws?node=${node}`,
        // Credential last. The daemon selects the first entry that is not a
        // `bmcd.bearer.` one, so the plain name has to be offered and has to
        // come first.
        ["bmcd.serial.v1", `bmcd.bearer.${token}`]
      );
      // Binary frames as ArrayBuffers rather than Blobs: a Blob would have to
      // be read asynchronously, which reorders UART output.
      socket.binaryType = "arraybuffer";

      // Narrowed once: every handler below closes over `live` rather than the
      // outer `let`, which the compiler cannot prove stays non-null.
      const live = socket;

      let opened = false;
      let errored = false;

      live.onopen = () => {
        opened = true;
        setState("open");
        setProtocol(live.protocol === "" ? null : live.protocol);
        fitRef.current?.fit();
      };

      live.onmessage = (event: MessageEvent<unknown>) => {
        const target = terminalRef.current;
        if (!target) return;

        // Bytes go to the terminal as bytes. Decoding them here would break
        // any multi-byte sequence a frame happens to split, and the terminal
        // has a decoder that carries state across writes.
        if (event.data instanceof ArrayBuffer) {
          target.write(new Uint8Array(event.data));
        } else if (typeof event.data === "string") {
          target.write(event.data);
        }
      };

      // The event carries nothing a browser is willing to expose. All it is
      // good for is telling a close that follows a failure apart from a clean
      // one, which is the difference between "it ended" and "it never started".
      live.onerror = () => {
        errored = true;
      };

      live.onclose = (event) => {
        setState(opened && !errored ? "closed" : "failed");
        setCloseInfo({ code: event.code, reason: event.reason });
      };

      // Keystrokes go to this socket and no other: registered with the socket
      // and disposed with it, so input cannot reach a socket that is closing.
      input = terminal.onData((data) => {
        if (live.readyState === WebSocket.OPEN) {
          live.send(data);
        }
      });
    };

    // The ring buffer first, then the socket. The daemon forwards only what
    // arrives after a subscriber joins, so without this a console opened on a
    // module that has been up for hours shows nothing at all. Ordering it this
    // way means the scrollback is already in the terminal before live bytes
    // land on top of it; the alternative -- attach first, replay after --
    // would put old output below new.
    void replay().then(() => {
      if (cancelled) return;
      if (import.meta.env.VITE_DEMO === "1") {
        // The demo has no daemon to stream from. The ring buffer it has just
        // replayed IS the exhibit; say so in the place a live socket would
        // name its protocol, rather than opening one and reporting failure.
        setState("open");
        setProtocol("a recording, not a live stream");
        return;
      }
      attach();
    });

    return () => {
      cancelled = true;
      input?.dispose();
      if (socket) {
        // Detached before the close so the teardown does not set state on a
        // component that is unmounting, or overwrite the state the next
        // connection attempt has already set.
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close();
      }
    };
  }, [base, node, token, usable, generation, replay]);

  const stateLabel: Record<ConnectionState, string> = {
    connecting: t("console.stateConnecting"),
    open: t("console.stateOpen"),
    closed: t("console.stateClosed"),
    failed: t("console.stateFailed"),
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <span
            className={cn(
              "font-semibold",
              shown === "connecting" && "opacity-60",
              shown === "closed" && "text-amber-600 dark:text-amber-500",
              shown === "failed" && "text-red-600 dark:text-red-400"
            )}
          >
            {stateLabel[shown]}
          </span>

          {shown === "open" && protocol !== null && (
            <span className="text-sm opacity-60">
              {t("console.negotiated", { protocol })}
            </span>
          )}

          {(shown === "closed" || shown === "failed") && closeInfo !== null && (
            <span className="text-sm opacity-60">
              {closeInfo.reason === ""
                ? t("console.closeCode", { code: closeInfo.code })
                : t("console.closeCodeReason", {
                    code: closeInfo.code,
                    reason: closeInfo.reason,
                  })}
            </span>
          )}
        </div>

        <div className="flex gap-4">
          <Button
            type="button"
            variant="bw"
            onClick={() => terminalRef.current?.clear()}
          >
            {t("console.clearButton")}
          </Button>
          <Button
            type="button"
            variant="bw"
            onClick={() => {
              // Clear, then write the daemon's buffer back. Redraw means "show
              // me what the module's screen actually says", so it replaces the
              // terminal's contents with the daemon's rather than appending a
              // second copy below the first. It costs local scrollback beyond
              // the daemon's 16 KiB, which is the trade a redraw is.
              terminalRef.current?.clear();
              void replay();
            }}
          >
            {t("console.redrawButton")}
          </Button>
          <Button
            type="button"
            onClick={() => {
              setState("connecting");
              setCloseInfo(null);
              setProtocol(null);
              setGeneration((previous) => previous + 1);
            }}
          >
            {t("console.reconnectButton")}
          </Button>
        </div>
      </div>

      {!usable && (
        <p className="mb-4 text-sm text-red-600 dark:text-red-400">
          {t("console.noSession")}
        </p>
      )}

      {shown === "failed" && usable && (
        <p className="mb-4 text-sm opacity-60">{t("console.failedHint")}</p>
      )}

      <div
        ref={containerRef}
        role="region"
        aria-label={t("console.ariaTerminal", { nodeId: node + 1 })}
        className="h-96 w-full overflow-hidden rounded-md border border-neutral-200 bg-white p-2 dark:border-neutral-700 dark:bg-neutral-900"
      />

      <p className="mt-2 flex items-center gap-1 text-sm opacity-60">
        {t("console.inputTerm")}
        <InfoNote
          text={t("console.inputNote")}
          path="/features/a-console-to-every-module/#two-ways-to-type-and-they-are-not-the-same"
          label={t("console.inputTerm")}
        />
      </p>
    </div>
  );
}
