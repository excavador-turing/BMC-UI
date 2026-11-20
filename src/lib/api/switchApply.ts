/**
 * What the switch page makes of the daemon's answer to an apply, kept free of
 * React so `npm test` can run it.
 *
 * The daemon refuses two LACP applies with a 409 before it touches anything,
 * and the page can do something about only one of them:
 *
 * - **Hand-written `interfaces`.** LACP needs `bond0` declared in
 *   /etc/network/interfaces so that a reboot can bring the bond up, and a file
 *   somebody wrote by hand is not replaced without being asked. The page asks
 *   with a checkbox and sends the request again with `replace_hand_written`.
 * - **A `bond0` the daemon did not make.** Nothing the page can offer is safe;
 *   the person has to remove it or keep managing it by hand.
 *
 * The daemon sends both as one status with a sentence in the body, so the
 * sentence is what tells them apart. The two phrases below are the stable
 * words of those sentences; a daemon that rewords them degrades to the
 * generic toast, with the daemon's own words in it.
 */

import type { AxiosError } from "axios";

import { bmcdMessage } from "./bmcdMessage.ts";

export type ApplyRefusal =
  | { kind: "hand_written"; message: string }
  | { kind: "bond_exists"; message: string }
  | { kind: "other"; message: string };

/** The request field is named in the sentence only when saying yes would help. */
const ASKS_TO_REPLACE = "replace_hand_written";
const BOND_IS_THERE = "bond0 already exists";

export function classifyApply(error: Error): ApplyRefusal {
  const message = bmcdMessage(error);
  const status = (error as AxiosError).response?.status;
  if (status === 409) {
    if (message.includes(ASKS_TO_REPLACE)) {
      return { kind: "hand_written", message };
    }
    if (message.includes(BOND_IS_THERE)) {
      return { kind: "bond_exists", message };
    }
  }
  return { kind: "other", message };
}

/**
 * The body of the apply request: the document, the window if one was chosen,
 * and `replace_hand_written` only once it was agreed to -- never as `false`,
 * because a daemon from before it existed has no such field and the key's
 * absence is what it expects.
 */
export function switchApplyBody(
  proposed: object,
  windowSeconds: number | null,
  replaceHandWritten: boolean
): Record<string, unknown> {
  const body: Record<string, unknown> = { ...proposed };
  if (windowSeconds !== null) body.window_s = windowSeconds;
  if (replaceHandWritten) body.replace_hand_written = true;
  return body;
}
