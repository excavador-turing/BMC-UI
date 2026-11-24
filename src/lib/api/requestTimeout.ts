/**
 * How long a request waits for the board, and what a request that got no
 * answer means. Kept free of React so `npm test` can run it.
 *
 * Until this existed no request had a limit. A board that dropped off the
 * network was found by the browser giving up on the connection, which took
 * 80 seconds (excavador-turing/BMC-Firmware#121), and a power change sent in
 * that time sat pending: it could still reach the board later, or never, and
 * the page could not say which.
 *
 * One limit does not fit every request, so each class has its own:
 *
 * - a read gets `READ_TIMEOUT_MS`;
 * - a read the page repeats every few seconds gets `POLL_TIMEOUT_MS`, so the
 *   interval plus the limit stays about ten seconds, which is how soon the
 *   "board stopped answering" banner has to appear;
 * - a state change gets `STATE_CHANGE_TIMEOUT_MS`: bmcd answers a power
 *   change in well under a second, but it shares one small CPU with a flash;
 * - a request that makes the board go and fetch something, or write a lot,
 *   gets the longer limits below;
 * - an upload, and the transfer that follows it, have none: they last as long
 *   as the file does, and the browser reports a broken connection on its own.
 */

/** A read, the default for every request. */
export const READ_TIMEOUT_MS = 8_000;

/** A read the page repeats every few seconds. */
export const POLL_TIMEOUT_MS = 5_000;

/** A state change: power, USB, a setting. */
export const STATE_CHANGE_TIMEOUT_MS = 15_000;

/** The progress of a flash or a firmware transfer, read while the board is busy with it. */
export const TRANSFER_POLL_TIMEOUT_MS = 15_000;

/** A read that makes the board look outside, such as the update check. */
export const SLOW_READ_TIMEOUT_MS = 30_000;

/** A state change that installs, imports, repairs or archives. */
export const SLOW_CHANGE_TIMEOUT_MS = 120_000;

/** axios's spelling of "no limit". */
export const NO_TIMEOUT = 0;

/**
 * The limit a request actually gets. The instance's default is the limit of a
 * read, so a request that carries exactly that and is not a GET did not ask
 * for anything: it is a state change, and gets the limit of one. Anything else
 * a request carries, a longer limit or none at all, is its own and is kept.
 */
export function limitFor(
  method: string | undefined,
  timeout: number | undefined
): number | undefined {
  if (timeout !== READ_TIMEOUT_MS) return timeout;
  return (method ?? "get").toLowerCase() === "get"
    ? READ_TIMEOUT_MS
    : STATE_CHANGE_TIMEOUT_MS;
}

/**
 * Whether a request failed without the board answering at all: it timed out,
 * or the connection broke, or it never opened.
 *
 * Only an axios error counts. Two things lack a `response`, and only one of
 * them is a board that did not answer: the other is a query that threw its
 * own `Error` because the daemon answered with the wrong shape, and that is a
 * board that is there. axios marks its own errors and sets `response` whenever
 * the board said anything, a refusal included. A request this page cancelled
 * itself is not the board's silence either.
 */
export function isUnanswered(error: unknown): boolean {
  const e = error as
    | { isAxiosError?: boolean; response?: unknown; code?: string }
    | null
    | undefined;
  return (
    e?.isAxiosError === true &&
    e.response === undefined &&
    e.code !== "ERR_CANCELED"
  );
}
