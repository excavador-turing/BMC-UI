/**
 * The speeds the console's select offers, and what a node runs at until one
 * is stored.
 *
 * bmcd keeps `uart_baud` per node and applies it as the port's real speed, at
 * startup and on every change. A node with nothing stored runs at
 * `DEFAULT_BAUD`, so that is what the interface shows for it too.
 */
export const DEFAULT_BAUD = 115200;

export const BAUD_RATES = [
  9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600, 1000000, 1500000,
];

/** What the node runs at: the stored speed, or the default when none is. */
export function effectiveBaud(stored: number | null | undefined): number {
  return typeof stored === "number" && Number.isFinite(stored) && stored > 0
    ? stored
    : DEFAULT_BAUD;
}

/**
 * The choices for a node, with its own speed among them.
 *
 * A speed stored by hand (a curl, a config import) that is not in the list is
 * added, so opening the select and saving never quietly replaces it with the
 * nearest listed one.
 */
export function baudChoices(current: number): number[] {
  return BAUD_RATES.includes(current)
    ? BAUD_RATES
    : [...BAUD_RATES, current].sort((a, b) => a - b);
}

/** How much of the newest output is judged. */
export const GARBLE_WINDOW = 4096;

/** Fewer characters than this say nothing: a boot banner's first line. */
export const GARBLE_MIN_SAMPLE = 64;

/** The share of unreadable characters from which the speed is suspect. */
export const GARBLE_THRESHOLD = 0.25;

/**
 * Whether a character is one a console prints when the speed is right.
 *
 * What a wrong speed produces is the replacement character (a byte that is
 * not UTF-8) and control characters nobody sends on purpose. A terminal's own
 * controls are fine: tab, line feed, carriage return, backspace, bell and
 * escape, which starts every colour and cursor sequence.
 */
function isReadable(code: number): boolean {
  if (code === 0xfffd) return false;
  if (code < 0x20) {
    return (
      code === 0x09 ||
      code === 0x0a ||
      code === 0x0d ||
      code === 0x08 ||
      code === 0x07 ||
      code === 0x1b
    );
  }
  return code < 0x7f || code > 0x9f;
}

/** The share of the newest output that is not readable, 0 to 1. */
export function garbledShare(text: string): number {
  const sample = text.slice(-GARBLE_WINDOW);
  if (sample.length === 0) return 0;
  let bad = 0;
  for (let i = 0; i < sample.length; i++) {
    if (!isReadable(sample.charCodeAt(i))) bad++;
  }
  return bad / sample.length;
}

/**
 * Does this output look like a console read at the wrong speed?
 *
 * A module that prints at 1500000 read at 115200 (an RK1 left at the default,
 * which is what a node with no stored speed runs at) arrives as a stream of
 * replacement characters and control bytes, while the same board's neighbours
 * at 115200 are fine. A reader sees garbage and no hint why, so the console
 * says what it looks like.
 *
 * A guess, and worded as one: "looks like". A module that really sends binary
 * crosses the threshold too, and the notice is dismissed by Clear.
 */
export function looksLikeWrongSpeed(text: string): boolean {
  const sampleLength = Math.min(text.length, GARBLE_WINDOW);
  return (
    sampleLength >= GARBLE_MIN_SAMPLE && garbledShare(text) >= GARBLE_THRESHOLD
  );
}
