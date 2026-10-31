/**
 * What a BMC reboot does to the compute modules, by board revision, kept free
 * of React so `npm test` can run it.
 *
 * The Turing Pi 2 v2.4 has no latch on the node power rails: they are driven
 * straight from the BMC SoC's pins, so any BMC reboot power-cycles all four
 * nodes. The v2.5 has latches, and its nodes keep running. The dialogs used to
 * say the second thing to everybody.
 *
 * An unknown revision (the answer has not arrived, the daemon would not give
 * it, a revision this file has not heard of) is neither: the copy then says
 * both, because either claim alone would be wrong for somebody.
 *
 * No imports: this file runs under node with nothing else loaded.
 */

/** What happens to the nodes when the BMC reboots. */
export type RebootNodes = "keep_running" | "power_cycled" | "unknown";

/**
 * `board_revision` as `GET /bmc?opt=get&type=about` sends it -- `v2.5.2` --
 * read as the revision of the board. Only 2.4 and 2.5 are known; anything else
 * is `unknown`, never a guess.
 */
export function nodesOnReboot(revision: unknown): RebootNodes {
  if (typeof revision !== "string") return "unknown";
  // The field is read from a fixed-width EEPROM and may arrive NUL-padded.
  const clean = revision.split("\u0000").join("").trim();
  const match = /^v?(\d+)\.(\d+)(?:\.|$)/i.exec(clean);
  if (!match) return "unknown";
  const [major, minor] = [Number(match[1]), Number(match[2])];
  if (major === 2 && minor === 4) return "power_cycled";
  if (major === 2 && minor === 5) return "keep_running";
  return "unknown";
}
