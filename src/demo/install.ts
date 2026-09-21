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

import type { AddressDocument, AddressState } from "@/lib/api/get";

import { DemoAddress, verdictFor } from "./address";

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

function fixture(name: string): unknown {
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

/**
 * The one write the demo answers rather than refuses, and why: the address
 * feature IS a sequence -- apply, a window, a confirmation that must arrive
 * over the new address, a revert when it does not -- and a fixture can only
 * show one frozen frame of it. `./address.ts` says what this is and, more
 * importantly, what it is not.
 */
/** A request body, typed once. `JSON.parse` answers `any`, and exactly one
 * place in this file is allowed to say what it is. */
function sent<T>(config: InternalAxiosRequestConfig): T | null {
  if (typeof config.data !== "string") return null;
  return JSON.parse(config.data) as T;
}

let address: DemoAddress | null = null;

function demoAddress(): DemoAddress | null {
  if (address) return address;
  const captured = fixture("address") as AddressState | undefined;
  if (!captured) return null;
  address = new DemoAddress(captured);
  return address;
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

  // Path-style reads, bmcd 2.36 and 2.37: the switch document, its presets,
  // the certificate the board serves, and who may reach it. Fixtures like any
  // other; a miss falls through to the 404 below, which is what an older
  // daemon answers and what the cards hide themselves on.
  const reads: Record<string, string> = {
    "/bmc/network/switch": "switch",
    "/bmc/network/switch/presets": "switch_presets",
    "/bmc/tls/certificate": "tls_certificate",
    "/bmc/access": "access",
    "/bmc/network/address/limits": "address_limits",
    "/bmc/network/address": "address",
  };
  if (method === "get") {
    // The address is the one read that is not a constant: it carries the
    // pending change and its deadline, and the card polls it to notice the
    // board reverting on its own.
    if (url.endsWith("/bmc/network/address")) {
      const state = demoAddress();
      if (state) return reply(config, 200, state.view());
    }
    for (const [suffix, name] of Object.entries(reads)) {
      if (url.endsWith(suffix)) {
        const data = fixture(name);
        if (data !== undefined) return reply(config, 200, data);
      }
    }
  } else if (url.endsWith("/bmc/network/address/validate")) {
    // The judgement is the board's, and in the demo the board is us. The
    // words are the daemon's own (see ./address.ts).
    const document = sent<AddressDocument>(config);
    if (!document) return reply(config, 400, { detail: "no document" });
    return reply(config, 200, verdictFor(document));
  } else if (method === "put" && url.endsWith("/bmc/network/address")) {
    const state = demoAddress();
    const body = sent<AddressDocument & { window_s?: number }>(config);
    if (!state || !body) return reply(config, 400, { detail: "no document" });
    const { window_s, ...document } = body;
    const verdict = verdictFor(document);
    if (verdict.refusal) {
      return reply(
        config,
        400,
        {
          type: "about:blank",
          title: "The board refused this address",
          status: 400,
          detail: verdict.refusal.reason,
        },
        "application/problem+json"
      );
    }
    // 202, as the daemon answers: applied, and waiting to be proved right.
    return reply(config, 202, state.apply(document, window_s ?? 30));
  } else if (url.endsWith("/bmc/network/address/confirm")) {
    const state = demoAddress();
    const token = sent<{ token?: string }>(config)?.token;
    if (!state || !token) return reply(config, 400, { detail: "no token" });
    const result = state.confirm(token);
    if ("error" in result) {
      return reply(
        config,
        409,
        {
          type: "about:blank",
          title: "Nothing to confirm",
          status: 409,
          detail: result.error,
        },
        "application/problem+json"
      );
    }
    return reply(config, 200, result);
  } else if (url.endsWith("/bmc/network/address/revert")) {
    const state = demoAddress();
    if (!state) return reply(config, 400, { detail: "no address" });
    return reply(config, 200, state.revert());
  } else if (url.includes("/bmc/")) {
    // Every write on a path-style endpoint -- a switch document, a
    // certificate, a password, the client CA -- and the validate call, which
    // is a judgement only the daemon can make: refused, and said so.
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
