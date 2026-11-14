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
