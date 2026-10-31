/**
 * What the address card and the dashboard decide from the daemon's answer,
 * kept free of React so `npm test` can run it.
 *
 * The rule that holds the file together: a daemon older than 2.41.0 sends none
 * of the newer fields, and an absent field never reads as a refusal. It reads
 * as the old behaviour -- the board has its bridge, nothing else is listed.
 *
 * Types are imported with `import type` only: they are erased, so this file
 * runs under node with nothing else loaded.
 */

import type { AddressInterface, AddressState, DaemonTime } from "./get";

/** How long a failed apply stays on the page. After it, it is history. */
export const APPLY_FAILED_SHOWN_MS = 10 * 60 * 1000;

/**
 * Unix seconds, or the daemon's own time shapes, as milliseconds. Null when it
 * cannot be read -- a banner about a time nobody can read is not worth showing.
 */
export function timeMillis(
  value: DaemonTime | number | null | undefined
): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value * 1000 : null;
  }
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value.secs_since_epoch === "number") {
    return (
      value.secs_since_epoch * 1000 +
      Math.floor((value.nanos_since_epoch ?? 0) / 1e6)
    );
  }
  return null;
}

/**
 * Is the "last change could not be applied" banner still current at `nowMs`?
 *
 * It used to show for as long as the daemon remembered the revert, which is
 * until the next apply: a failure from last week, in red, on every visit.
 */
export function applyFailedShown(
  lastRevert: AddressState["last_revert"] | undefined,
  nowMs: number
): boolean {
  if (lastRevert?.reason !== "apply_failed") return false;
  const at = timeMillis(lastRevert.at);
  if (at === null) return false;
  // A board clock a little ahead of this one is still "just now".
  return nowMs - at < APPLY_FAILED_SHOWN_MS;
}

/** Does the board have the bridge this page manages? Absent reads as yes. */
export function managedPresent(state: AddressState): boolean {
  return state.managed_interface_present !== false;
}

/** Every interface, the one carrying the default route first, order kept. */
export function orderInterfaces(
  interfaces: AddressInterface[] | undefined
): AddressInterface[] {
  const all = interfaces ?? [];
  return [
    ...all.filter((i) => i.default_route === true),
    ...all.filter((i) => i.default_route !== true),
  ];
}

/** Interfaces that carry an address -- what the dashboard has room to show. */
export function addressedInterfaces(
  interfaces: AddressInterface[] | undefined
): AddressInterface[] {
  return orderInterfaces(interfaces).filter(
    (i) => (i.addresses?.length ?? 0) > 0
  );
}

/**
 * Does applying need the person's say-so to replace a file written by hand?
 * Only where the page can apply at all.
 */
export function needsReplaceConsent(state: AddressState): boolean {
  return (
    managedPresent(state) &&
    (state.file === "hand_edited" || state.file === "unreadable")
  );
}

/**
 * The body of the apply request. `replace_hand_written` is sent only once it
 * was agreed to, and never as `false`: an older daemon has no such field and
 * the key's absence is what it expects.
 */
export function applyBody(
  proposed: object,
  windowSeconds: number | null,
  replaceHandWritten: boolean
): Record<string, unknown> {
  const body: Record<string, unknown> = { ...proposed };
  if (windowSeconds !== null) body.window_s = windowSeconds;
  if (replaceHandWritten) body.replace_hand_written = true;
  return body;
}
