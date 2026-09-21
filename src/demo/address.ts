/**
 * The board's own address, simulated, for the demo only.
 *
 * Every other write in the demo is refused: a captured board cannot be
 * changed, and pretending otherwise would be the first thing on the site
 * that was not measured. The address is the one exception, and it earns it.
 *
 * The feature's whole point is a SEQUENCE -- apply, a window running, a
 * confirmation that must arrive over the new address, and the old address
 * coming back by itself when it does not. A screenshot cannot show that, and
 * neither can a fixture: the card would render one frozen frame of a story
 * whose subject is time passing. So the demo keeps the state machine in
 * memory and runs it, and a reader can watch a change revert itself rather
 * than read that it would.
 *
 * WHAT THIS IS NOT. The site's standing rule is that the interface keeps no
 * copy of the daemon's rules: the board judges, and the card shows the
 * board's own words. That rule is intact. This file is not part of the card;
 * it is the demo's STAND-IN FOR THE BOARD, the thing on the other side of
 * the wire, and it exists only under `VITE_DEMO=1`. The card still asks and
 * still renders whatever the answer says -- it simply gets its answers from
 * here instead of from bmcd. The refusals and warnings below are copied from
 * `bmcd/src/app/address_document.rs` word for word so that what the demo
 * says is what a board would say; if they ever drift, the demo is wrong and
 * the daemon is right.
 *
 * Nothing persists: a reload starts from the captured fixture again.
 */

import type {
  AddressDocument,
  AddressLive,
  AddressPending,
  AddressState,
} from "@/lib/api/get";

/** The daemon's `SystemTime`: how it serialises a moment. */
function now(): { secs_since_epoch: number; nanos_since_epoch: number } {
  const ms = Date.now();
  return {
    secs_since_epoch: Math.floor(ms / 1000),
    nanos_since_epoch: (ms % 1000) * 1_000_000,
  };
}

/* ---- IPv4, enough of it ------------------------------------------------- */

function toU32(address: string): number | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  let out = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    out = (out << 8) | n;
  }
  return out >>> 0;
}

function toDotted(value: number): string {
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join(".");
}

function maskOf(prefix: number): number {
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
}

/* ---- the verdict, in the daemon's words --------------------------------- */

export interface DemoVerdict {
  document: AddressDocument;
  refusal: { reason: string } | null;
  warnings: { reason: string }[];
}

const PREFIX_MIN = 8;
const PREFIX_MAX = 30;

export function verdictFor(document: AddressDocument): DemoVerdict {
  if (document.mode !== "static") {
    return { document, refusal: null, warnings: [] };
  }

  const { address, prefix, gateway, dns, search } = document;
  const value = toU32(address);
  const refuse = (reason: string): DemoVerdict => ({
    document,
    refusal: { reason },
    warnings: [],
  });

  if (value === null) {
    return refuse(`${address} is not an address a board can be reached at`);
  }
  if (!Number.isInteger(prefix) || prefix < PREFIX_MIN || prefix > PREFIX_MAX) {
    return refuse(
      `a /${prefix} prefix cannot be used: it must be between /${PREFIX_MIN} and ` +
        `/${PREFIX_MAX}, so the network has room for the board and a gateway`
    );
  }

  const first = (value >>> 24) & 255;
  const unusable =
    first === 127 || // loopback
    first === 0 || // unspecified
    first >= 224 || // multicast and above, and 255.255.255.255
    (first === 169 && ((value >>> 16) & 255) === 254); // link-local
  if (unusable) {
    return refuse(`${address} is not an address a board can be reached at`);
  }

  const mask = maskOf(prefix);
  const network = (value & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  const subnet = `${toDotted(network)}/${prefix}`;

  if (value === network) {
    return refuse(
      `${address} is the network address of ${subnet}, not a host on it`
    );
  }
  if (value === broadcast) {
    return refuse(
      `${address} is the broadcast address of ${subnet}, not a host on it`
    );
  }

  if (gateway) {
    const gw = toU32(gateway);
    if (gw === null || (gw & mask) >>> 0 !== network) {
      return refuse(
        `the gateway ${gateway} is not on ${subnet}; the board could never reach it`
      );
    }
    if (gw === value) {
      return refuse(`the gateway cannot be the board's own address ${address}`);
    }
  }

  if (search !== null && search !== undefined) {
    if (search === "" || !/^[A-Za-z0-9.-]+$/.test(search)) {
      return refuse(
        "the search domain may contain letters, digits, dots and hyphens only"
      );
    }
  }

  // Applied, and still worth hearing. The second of these is the one that
  // sent a reader to Discord with a clock that said nothing useful.
  const warnings: { reason: string }[] = [];
  if (!gateway) {
    warnings.push({
      reason:
        "no gateway: the board will reach its own subnet and nothing beyond it, " +
        "which includes the public NTP pool and any firmware source on the internet",
    });
  }
  if (!dns || dns.length === 0) {
    warnings.push({
      reason:
        "no resolver: names will not resolve on the board, so `pool.ntp.org` and " +
        "a firmware source given by name will fail until one is added",
    });
  }
  return { document, refusal: null, warnings };
}

/* ---- the state machine -------------------------------------------------- */

function liveFor(document: AddressDocument, lease: AddressLive): AddressLive {
  if (document.mode === "dhcp") return lease;
  return {
    mode: "static",
    address: `${document.address}/${document.prefix}`,
    gateway: document.gateway ?? null,
    dns: document.dns ?? [],
    search: document.search ?? null,
  };
}

export class DemoAddress {
  private state: AddressState;
  /** What DHCP gave the board, kept so going back to it looks right. */
  private readonly lease: AddressLive;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(captured: AddressState) {
    this.state = structuredClone(captured);
    this.lease = structuredClone(captured.live);
  }

  view(): AddressState {
    return structuredClone(this.state);
  }

  /**
   * `PUT`: 202 and a window. The address goes on the bridge and NOTHING is
   * written until a confirmation arrives -- `configured` is untouched here,
   * exactly as on a board, which is why a reboot mid-window comes back on
   * the old one.
   */
  apply(document: AddressDocument, windowSeconds: number): AddressPending {
    const pending: AddressPending = {
      token: `demo-${Math.random().toString(36).slice(2, 10)}`,
      document,
      applied_at: now(),
      window_s: windowSeconds,
    };
    this.clearTimer();
    this.state.pending = pending;
    this.state.running = document;
    this.state.live = liveFor(document, this.lease);
    this.state.last_revert = null;
    this.timer = setTimeout(
      () => this.rollBack("not_confirmed"),
      windowSeconds * 1000
    );
    return pending;
  }

  /** The proof. On a board it is the connection's address; here, the token. */
  confirm(token: string): AddressState | { error: string } {
    const pending = this.state.pending;
    if (pending?.token !== token) {
      return { error: "there is no change waiting for that token" };
    }
    this.clearTimer();
    this.state.configured = pending.document;
    this.state.running = pending.document;
    this.state.live = liveFor(pending.document, this.lease);
    this.state.file = "bmcd";
    this.state.pending = null;
    this.state.last_revert = null;
    return this.view();
  }

  revert(): AddressState {
    this.rollBack("requested");
    return this.view();
  }

  private rollBack(reason: "not_confirmed" | "requested") {
    const pending = this.state.pending;
    if (!pending) return;
    this.clearTimer();
    const back = this.state.configured ?? { mode: "dhcp" as const };
    this.state.pending = null;
    this.state.running = back;
    this.state.live = liveFor(back, this.lease);
    this.state.last_revert = { at: now(), reason, document: pending.document };
  }

  private clearTimer() {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
