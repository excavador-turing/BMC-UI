/**
 * The demo: this interface, answering from fixtures instead of a board.
 *
 * Nothing in the hooks or components changes. axios lets an instance carry
 * its own transport -- the `adapter` -- and `useAxiosWithAuth` creates its
 * instances from `axios.defaults`, so installing an adapter on the defaults
 * before the first render puts every request through here. The 401
 * interceptor, the query keys, the polling intervals: all untouched, all
 * exercised.
 *
 * The fixtures were captured, not written (scripts/capture-fixtures.sh),
 * and `captured.json` says from which firmware and when. A demo that
 * invents its numbers would be the first thing on the site that was not
 * measured on the board.
 *
 * Only ever imported when `VITE_DEMO=1` (see app.tsx), so the fixtures are
 * not in the bundle a board serves.
 */

import type {
  AxiosAdapter,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import axios from "axios";

const fixtures = import.meta.glob("./fixtures/*.json", {
  eager: true,
  import: "default",
});
const metricsText =
  import.meta.glob("./fixtures/metrics.txt", {
    eager: true,
    query: "?raw",
    import: "default",
  })["./fixtures/metrics.txt"] ?? "";

function fixture(name: string): unknown | undefined {
  return fixtures[`./fixtures/${name}.json`];
}

// A little latency, so loading states render the way they do on a board.
// Zero would make every skeleton flash and vanish, which is not what the
// interface looks like.
const DELAY_MS = 120;

const REFUSED =
  "This is a demo. It reads from a captured board and cannot change anything.";

function reply(
  config: InternalAxiosRequestConfig,
  status: number,
  data: unknown,
  contentType = "application/json"
): Promise<AxiosResponse> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const response: AxiosResponse = {
        data,
        status,
        statusText: status === 200 ? "OK" : "Error",
        headers: { "content-type": contentType },
        config,
        request: {},
      };
      // axios treats non-2xx as errors on the caller's side; mirror that so
      // the interceptor and every hook see what they would from a board.
      if (status >= 200 && status < 300) resolve(response);
      else
        reject(
          Object.assign(
            new axios.AxiosError(
              `demo: ${status}`,
              String(status),
              config,
              {},
              response
            ),
            { response }
          )
        );
    }, DELAY_MS);
  });
}

function legacyResult(result: unknown) {
  return { response: [{ result }] };
}

export const demoAdapter: AxiosAdapter = (config) => {
  const method = (config.method ?? "get").toLowerCase();
  const url = config.url ?? "";
  const params = (config.params ?? {}) as Record<
    string,
    string | number | undefined
  >;

  if (url.endsWith("/bmc/authenticate")) {
    return reply(config, 200, {
      id: "demo",
      name: "User Session",
      username: "root",
    });
  }

  if (url.endsWith("/bmc/serial/status")) {
    return reply(config, 200, fixture("serial_status") ?? []);
  }

  if (url === "/bmc" || url.endsWith("/bmc")) {
    const opt = String(params.opt ?? "");
    const type = String(params.type ?? "");
    if (opt === "get") {
      const name = type === "uart" ? `uart_${params.node ?? 0}` : type;
      const data = fixture(name);
      if (data !== undefined) return reply(config, 200, data);
      // An honest miss, in the legacy envelope, so the page says what it lacks
      // rather than rendering a skeleton forever.
      return reply(
        config,
        200,
        legacyResult(`not captured for this demo: ${type}`)
      );
    }
    if (opt === "set") {
      // The legacy form puts a refusal's message inside a 200, and every
      // mutation hook surfaces `result` as a toast. Say what happened.
      return reply(config, 200, legacyResult(REFUSED));
    }
  }

  if (url.endsWith("/bmc/backup") || url.includes("/bmc/upload/")) {
    return reply(
      config,
      403,
      {
        type: "about:blank",
        title: "This is a demo",
        status: 403,
        detail: REFUSED,
      },
      "application/problem+json"
    );
  }

  if (url.endsWith("/metrics")) {
    return reply(config, 200, metricsText, "text/plain");
  }

  return reply(
    config,
    404,
    {
      type: "about:blank",
      title: "Not in the demo",
      status: 404,
      detail: `${method.toUpperCase()} ${url} is not captured.`,
    },
    "application/problem+json"
  );
};

/**
 * Install before the first render. Also seeds a session, because the demo is
 * the interface behind the login, not the login form.
 */
/**
 * The console's scrollback replay reads the uart ring buffer with `fetch`,
 * not through axios, so an adapter alone leaves that one request going to a
 * board that is not there. Same fixtures, second transport.
 */
function installFetch(): void {
  const real = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const u = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
      location.href
    );
    if (!u.pathname.includes("/api/bmc")) return real(input, init);
    const params: Record<string, string> = {};
    u.searchParams.forEach((v, k) => {
      params[k] = v;
    });
    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toLowerCase();
    // Reuse the adapter by handing it an axios-shaped request; its reply is
    // an axios-shaped response, which we turn back into a Response.
    const path = u.pathname.replace(/^.*\/api/, "");
    try {
      const r = await demoAdapter({
        url: path,
        method,
        params,
        headers: {},
      } as InternalAxiosRequestConfig);
      const body = typeof r.data === "string" ? r.data : JSON.stringify(r.data);
      return new Response(body, {
        status: r.status,
        headers: { "Content-Type": r.headers["content-type"] as string },
      });
    } catch (e) {
      const r = (e as { response?: AxiosResponse }).response;
      if (!r) throw e;
      return new Response(JSON.stringify(r.data), {
        status: r.status,
        headers: { "Content-Type": r.headers["content-type"] as string },
      });
    }
  };
}

export function installDemo(): void {
  axios.defaults.adapter = demoAdapter;
  installFetch();
  try {
    // 64 hex characters: the shape the daemon issues, and the shape the console
    // will accept into a WebSocket subprotocol name.
    localStorage.setItem("token", "0123456789abcdef".repeat(4));
    localStorage.setItem("username", "root");
  } catch {
    // storage blocked: the login page will show, and the adapter still answers it.
  }
}
