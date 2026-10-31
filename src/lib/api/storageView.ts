/**
 * What the settings-storage banner decides from the daemon's answer, kept free
 * of React so `npm test` can run it.
 *
 * `GET /bmc/storage` exists from bmcd 2.42.0. An older daemon answers 404 (or
 * its page of HTML), and the rule that holds the file together is the one the
 * address card follows: a missing answer, or a field this file does not know,
 * is "show nothing", never a fault. A banner telling someone their settings
 * will not survive a reboot is only worth showing when the board said so.
 *
 * Types are imported with `import type` only: they are erased, so this file
 * runs under node with nothing else loaded.
 */

import type { components, operations } from "./schema";

type Schemas = components["schemas"];

/**
 * The daemon's own description of the answer (bmcd 2.42.0's OpenAPI document,
 * `npm run api:refresh`). The TYPE is exact; `parseStorage` below is not
 * trusting it, because an older daemon sends none of this and a newer one may
 * send values this file has never seen.
 */
export type StorageView = Schemas["StorageStatus"];
export type StorageState = StorageView["state"];
export type StorageReason = NonNullable<StorageView["reason"]>;
export type StorageBacking = StorageView["backing"];

/** The repair request body, as the daemon's document spells it. */
export type RepairBody =
  operations["repairStorage"]["requestBody"]["content"]["application/json"];

/** The banner that applies: a mount that failed, or KEY1 held at power-on. */
export type BannerKind = "unmounted" | "keyhold";

/** Where the page that explains a mount failure lives. */
export const KNOWN_FAULTS_URL = "https://turingpi.xyz/reference/known-faults/";

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.trim() === "" ? null : value;
}

/**
 * The daemon's answer, or null when it is not one: not an object (a page of
 * HTML, a string), which is what an older daemon sends. Anything missing or
 * unrecognised inside an object reads as the quiet value -- `unknown` state,
 * no reason, not repairable -- so no banner is raised on a guess.
 */
export function parseStorage(data: unknown): StorageView | null {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return null;
  }
  const raw = data as Record<string, unknown>;
  const state: StorageState =
    raw.state === "persistent" || raw.state === "temporary"
      ? raw.state
      : "unknown";
  const reason: StorageReason | null =
    raw.reason === "requested" ||
    raw.reason === "mount_failed" ||
    raw.reason === "unrecorded"
      ? raw.reason
      : null;
  const backing: StorageBacking =
    raw.backing === "ubi" || raw.backing === "mmc" ? raw.backing : "unknown";
  return {
    state,
    reason,
    detail: text(raw.detail),
    backing,
    // Only an explicit true: "may the volume be removed" is not a thing to
    // read into an absent field.
    repairable: raw.repairable === true,
    repair_blocker: text(raw.repair_blocker),
  };
}

/**
 * Which banner to draw, or null for none.
 *
 * Only `temporary` is a banner. KEY1 held is its own message because the
 * remedy is different (let go and reboot); every other reason -- a mount that
 * failed, one the daemon did not record, one this interface has never heard of
 * -- is the factory-defaults message, which is true of all of them.
 */
export function bannerKind(
  view: StorageView | null | undefined
): BannerKind | null {
  if (view?.state !== "temporary") return null;
  return view.reason === "requested" ? "keyhold" : "unmounted";
}

/**
 * Is the repair button offered? Only where the settings volume could not be
 * mounted, and the daemon says it can be removed. With KEY1 held the volume
 * is fine and not loading it is deliberate: removing it would erase settings
 * that a reboot without KEY1 brings back, so the button is not offered
 * however the daemon answers.
 *
 * The repair ERASES what is saved on the volume. The daemon only knows the
 * mount failed, which can be transient, so a plain reboot comes first (see
 * `showReboot`).
 */
export function showRepair(view: StorageView | null | undefined): boolean {
  return bannerKind(view) === "unmounted" && view?.repairable === true;
}

/**
 * Is the plain reboot offered beside the repair? Wherever the mount failed,
 * and whether or not the repair is on offer: the daemon's blocker "There is no
 * settings volume to remove; reboot the BMC to recreate it" has no other
 * button to point at. Not with KEY1 held -- that remedy is to reboot without
 * KEY1, which a button cannot do.
 */
export function showReboot(view: StorageView | null | undefined): boolean {
  return bannerKind(view) === "unmounted";
}

/**
 * The sentence to show instead of the button, when there is no button and the
 * daemon said why.
 */
export function repairBlocker(
  view: StorageView | null | undefined
): string | null {
  if (bannerKind(view) !== "unmounted" || view?.repairable === true) {
    return null;
  }
  return view?.repair_blocker ?? null;
}

/**
 * The body of the repair request, sent as `application/json` (the daemon
 * refuses it without that header, and without the flag).
 */
export function repairBody(): RepairBody & { confirm: true } {
  return { confirm: true };
}

/** The header the repair request carries with that body. */
export const REPAIR_HEADERS = { "Content-Type": "application/json" } as const;
