import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { useApiBase } from "@/hooks/useApiBase";

/** How long a BMC reboot takes, measured: the upgrade guide's cost table. */
export const EXPECTED_REBOOT_SECONDS = 48;

/** Where the duration of the last reboot is left for the page that reloads. */
const CAME_BACK_KEY = "bmc-came-back-seconds";

const POLL_MS = 2000;

export type ConnectionState =
  /** The board is answering. */
  | "ok"
  /** We asked it to reboot, so this is expected and we know roughly how long. */
  | "rebooting"
  /** It stopped answering and we did not ask it to. */
  | "lost";

/**
 * Notice when the board goes away, and notice when it comes back.
 *
 * Until now neither happened. Every polling query in this application uses
 * `refetchInterval: (query) => (query.state.error ? false : N)`, which stops
 * the interval permanently on the first error — so a reboot silenced every
 * query and nothing resumed when the board returned. The tab held stale data
 * until somebody reloaded it, and a reboot the page itself started ended at a
 * toast.
 *
 * ## Why a reboot and a loss are told apart
 *
 * Because only one of them has a number. A reboot we asked for takes about 48
 * seconds and the page can say so; a cable pulled out takes as long as it
 * takes, and a countdown would be a promise nobody made. So `expectReboot` is
 * called by the two controls that cause one, and everything else that stops
 * answering is a loss.
 *
 * ## Why a NETWORK error and not any error
 *
 * A query that fails with a status is a board that answered. Endpoints are
 * allowed to refuse — a certificate endpoint on an older daemon, a control the
 * caller may not use — and treating those as a dead board would put an outage
 * banner over a board that is perfectly healthy. Only a request that got no
 * response at all counts.
 */
export function useBoardReconnect(): {
  state: ConnectionState;
  /** Seconds since the board stopped answering. */
  elapsed: number;
  /** How long the last reboot took, once, after the reload that followed it. */
  cameBackIn: number | null;
  expectReboot: () => void;
} {
  const { base } = useApiBase();
  const queryClient = useQueryClient();

  const [state, setState] = useState<ConnectionState>("ok");
  const [elapsed, setElapsed] = useState(0);
  // Read once, in the initialiser, because this is the tail end of the
  // PREVIOUS page's reboot and it is already true before the first render.
  // Reading it in an effect and then calling setState would render the banner
  // a frame late, and is the cascading-render pattern the lint rule objects
  // to -- rightly, for a value that never changes after mount.
  const [cameBackIn] = useState<number | null>(() => {
    let stored: string | null;
    try {
      stored = sessionStorage.getItem(CAME_BACK_KEY);
    } catch {
      // Private windows and blocked site data. Nothing here is important
      // enough to fail over.
      return null;
    }
    if (stored === null) return null;
    const seconds = Number(stored);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  });
  const startedAt = useRef<number | null>(null);

  // Cleared separately, so the number is said once rather than on every
  // reload for the rest of the session. Removing it in the initialiser would
  // do it twice under StrictMode and read oddly besides: an initialiser that
  // deletes things is not one.
  useEffect(() => {
    try {
      sessionStorage.removeItem(CAME_BACK_KEY);
    } catch {
      // As above.
    }
  }, []);

  const expectReboot = useCallback(() => {
    // The demo has no board to lose. Its reboot answers with a refusal
    // wrapped in a 200, which the mutation reads as success -- so without
    // this the exhibit would raise a rebooting banner, poll a board that does
    // not exist, and eventually reload itself.
    if (import.meta.env.VITE_DEMO === "1") return;
    startedAt.current = Date.now();
    setElapsed(0);
    setState("rebooting");
  }, []);

  // A board that stops answering without being asked to.
  //
  // Read from the query cache rather than an axios interceptor, because the
  // instances are built per call from `axios.defaults` and an interceptor
  // would have to be installed on every one of them.
  useEffect(() => {
    // See `expectReboot`: nothing in the demo is a real connection, and its
    // adapter answers everything, so this would never fire -- but a fixture
    // that is ever allowed to fail should not put an outage banner over the
    // exhibit.
    if (import.meta.env.VITE_DEMO === "1") return;
    const cache = queryClient.getQueryCache();
    return cache.subscribe(() => {
      if (startedAt.current !== null) return;
      const offline = cache.getAll().some((query) => {
        const error = query.state.error as
          { isAxiosError?: boolean; response?: unknown } | undefined | null;
        if (!error) return false;
        // ONLY AN AXIOS ERROR WITH NO RESPONSE. Two things lack a `response`
        // and only one of them is a dead board. The other is a query that
        // threw its own `Error` because the daemon answered with the wrong
        // shape -- the certificate and switch queries do exactly that on an
        // older daemon, by design, so the card can hide itself. Treating
        // those as a lost connection put the "board stopped answering"
        // banner over a perfectly healthy board, and worse: the probe then
        // succeeded, the page reloaded, the query threw again, and the page
        // reloaded again, every few seconds, on every board older than the
        // interface. Seen on bmc-2 under headless Chrome an hour after it
        // shipped.
        //
        // axios marks its own errors, and sets `response` whenever the board
        // answered at all. No response on an axios error means the request
        // never arrived or never came back, and nothing else does.
        return error.isAxiosError === true && error.response === undefined;
      });
      if (offline) {
        startedAt.current = Date.now();
        setElapsed(0);
        setState("lost");
      }
    });
  }, [queryClient]);

  // Poll until it answers, and count while we wait.
  useEffect(() => {
    if (state === "ok") return;

    let cancelled = false;

    const tick = window.setInterval(() => {
      if (startedAt.current === null) return;
      setElapsed(Math.round((Date.now() - startedAt.current) / 1000));
    }, 1000);

    const poll = window.setInterval(() => {
      void (async () => {
        let response: Response;
        try {
          response = await fetch(`${base}/bmc?opt=get&type=about`, {
            cache: "no-store",
          });
        } catch {
          return;
        }
        if (cancelled) return;
        // A 401 is a board that is up and wants a credential, which is
        // exactly what "it is back" means here. Only a body that is not the
        // daemon's answer means it is not really back.
        if (response.status === 401 || response.status === 403) {
          back();
          return;
        }
        if (!response.ok) return;
        // THE SHAPE, NOT THE STATUS. bmcd serves this interface from the same
        // listener and falls back to `index.html` for a path it does not
        // route, so a half-started daemon can answer 200 with a page of HTML.
        // Reloading on that would land on a page whose first real query
        // fails, which looks exactly like the fault this is meant to end.
        try {
          const body = (await response.json()) as {
            response?: { result?: unknown }[];
          };
          if (body.response?.[0]?.result === undefined) return;
        } catch {
          return;
        }
        back();
      })();
    }, POLL_MS);

    function back() {
      if (cancelled) return;
      cancelled = true;
      const seconds =
        startedAt.current === null
          ? 0
          : Math.round((Date.now() - startedAt.current) / 1000);
      try {
        sessionStorage.setItem(CAME_BACK_KEY, String(seconds));
      } catch {
        // See above: the number is a nicety, the reload is the point.
      }
      // A reload rather than invalidating the queries. Every interval in this
      // application is already `false` by now -- that is the fault this exists
      // for -- and there is no supported way to switch them all back on. A
      // reload is also what a person would have done.
      window.location.reload();
    }

    return () => {
      cancelled = true;
      window.clearInterval(tick);
      window.clearInterval(poll);
    };
  }, [state, base]);

  return { state, elapsed, cameBackIn, expectReboot };
}
