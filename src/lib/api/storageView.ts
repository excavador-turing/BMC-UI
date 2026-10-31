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
 * No runtime imports: this file runs under node with nothing else loaded.
 */

export type StorageState = "persistent" | "temporary" | "unknown";
export type StorageReason = "requested" | "mount_failed" | "unrecorded";
export type StorageBacking = "ubi" | "mmc" | "unknown";

export interface StorageView {
  state: StorageState;
  /** Null when the daemon gave none, or one this interface does not know. */
  reason: StorageReason | null;
  /** The daemon's own words about the failure, as they are. */
  detail: string | null;
  backing: StorageBacking;
  repairable: boolean;
  /** Why it cannot be repaired from here, in the daemon's words. */
  repair_blocker: string | null;
}

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
  if (!view || view.state !== "temporary") return null;
  return view.reason === "requested" ? "keyhold" : "unmounted";
}

/**
 * Is the repair button offered? Only where the volume is damaged, and the
 * daemon says it can be removed. With KEY1 held the volume is fine and not
 * loading it is deliberate: removing it would destroy settings that a reboot
 * without KEY1 brings back, so the button is not offered however the daemon
 * answers.
 */
export function showRepair(view: StorageView | null | undefined): boolean {
  return bannerKind(view) === "unmounted" && view?.repairable === true;
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

/** The body of the repair request. The daemon refuses it without the flag. */
export function repairBody(): { confirm: true } {
  return { confirm: true };
}
