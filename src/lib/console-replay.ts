/**
 * How much of the daemon's ring buffer a console has not shown yet.
 *
 * THE BUG THIS EXISTS FOR. The console writes the daemon's UART ring buffer
 * into the terminal before attaching the socket, because the daemon forwards
 * only what arrives after a subscriber joins -- without it, a console opened
 * on a module that has been up for hours shows nothing at all.
 *
 * Reconnect deliberately keeps the terminal and everything scrolled into it.
 * So every reconnect wrote the same 16 KiB again, underneath the identical
 * 16 KiB already on screen. Seen on both interfaces on 2026-09-12: five lines
 * of `eth0: renamed from ...`, then those same five lines again, carrying the
 * same kernel timestamps.
 *
 * Clearing the terminal first would fix the duplication and cost the thing
 * the scrollback is for: the daemon keeps only the last 16 KiB, so the
 * terminal is the only place a full boot survives at all. Throwing that away
 * on every reconnect trades one fault for a worse one.
 *
 * So instead: work out where the last thing we showed ends inside the buffer
 * we have just been handed, and write only what follows it.
 *
 * `shown` is a tail of what the terminal has already received -- from an
 * earlier replay and from live frames since. `buffer` is the ring as it
 * stands now. The two overlap by however much of the stream both cover, and
 * the answer is `buffer` minus that overlap.
 *
 * The overlap is the longest suffix of `shown` that is also a prefix of
 * `buffer`. It is computed with the prefix function of `buffer + NUL + shown`,
 * which is linear. The obvious loop over candidate lengths is quadratic, and
 * its worst case is the common one: a reconnect after a long gap, where
 * nothing overlaps and every candidate has to be rejected in turn.
 *
 * When the two do not overlap at all, the whole buffer is unseen. That is the
 * honest answer rather than a guess: the module wrote more than the ring holds
 * while we were away, so there is a hole in what can be shown, and the buffer
 * is better than nothing.
 */
export function unseenTail(shown: string, buffer: string): string {
  if (buffer === "" || shown === "") return buffer;

  // An overlap can never exceed the buffer, so only that much of the tail of
  // `shown` can take part in one. Bounding it keeps this linear in the ring
  // size rather than in how long the console has been open.
  const tail =
    shown.length > buffer.length ? shown.slice(-buffer.length) : shown;

  // NUL separates the two halves: the daemon decodes the ring as UTF-8 and a
  // terminal stream does not carry it, so it occurs in neither string and the
  // prefix function can never match across the join.
  const probe = buffer + SEPARATOR + tail;
  const prefix = new Array<number>(probe.length).fill(0);

  for (let i = 1; i < probe.length; i++) {
    let k = prefix[i - 1];
    while (k > 0 && probe[i] !== probe[k]) k = prefix[k - 1];
    if (probe[i] === probe[k]) k++;
    prefix[i] = k;
  }

  return buffer.slice(prefix[probe.length - 1]);
}

const SEPARATOR = String.fromCharCode(0);

/**
 * How much of what the terminal has been given is worth keeping to compare
 * against. Only as much as the largest ring the daemon can hand back can ever
 * take part in an overlap, so a whole session's output never needs holding in
 * memory. Two rings' worth is slack for a daemon whose buffer grows.
 */
export const SHOWN_TAIL_LIMIT = 64 * 1024;

export function rememberShown(shown: string, written: string): string {
  const next = shown + written;
  return next.length > SHOWN_TAIL_LIMIT ? next.slice(-SHOWN_TAIL_LIMIT) : next;
}
