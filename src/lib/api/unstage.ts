/**
 * Cancelling a staged firmware update, kept free of React so `npm test` can
 * run it.
 *
 * `POST opt=set&type=firmware_unstage` (bmcd 2.51.0, BMC-Firmware#124): the
 * next reboot starts the firmware that is running, and the board answers with
 * the slots as they are afterwards. It is a state change like any other, so it
 * goes through `sendStateChange`.
 *
 * It carries its own timeout. Requests have none by default, so a board that
 * stopped answering left the confirmation dialog open with the request
 * pending, and the error arrived a minute and a half later behind the dialog's
 * backdrop, where it could not be read. The cancel is a short operation on the
 * board -- clearing one variable and removing two files -- so fifteen seconds
 * is generous, and a timeout is reported as what it is: the request may or
 * may not have reached the board, and the slots are read again either way.
 */
export const UNSTAGE_TIMEOUT_MS = 15_000;

export function unstageRequest() {
  return {
    params: { opt: "set", type: "firmware_unstage" },
    timeout: UNSTAGE_TIMEOUT_MS,
  } as const;
}
