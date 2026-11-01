/**
 * The decisions the firmware page makes that are not drawing: how long to keep
 * asking while the board re-polls its sources, where an offered update comes
 * from, and whether there is a card to park an image on.
 *
 * Kept free of imports from the app so `npm test` can load it as plain
 * TypeScript.
 */

/**
 * How long the page keeps asking while the daemon says `refreshing`.
 *
 * Eleven minutes, because the daemon's own claim on a refresh lasts 600 s
 * (bmcd `firmware_catalog.rs`: a refresh that does not finish is declared
 * lost after that and the flag clears). Giving up earlier than the daemon
 * does leaves a page saying "checking" about work that is still going to
 * land; asking for longer asks about a flag the daemon has already dropped.
 *
 * Measured, 2026-11-01, on a board running the fork's v2.44.0: building the
 * fork's release list alone takes 170 s, and the whole fan-out over several
 * sources can take minutes. The earlier bound (two minutes, "the slowest
 * measured was 16 s") was true of a board with one source and a short list.
 */
export const REFRESH_GIVE_UP_MS = 11 * 60 * 1000;

/**
 * How long to wait before the next poll, or null to stop asking.
 *
 * Quick at first, because a refresh that is going to be quick is over in
 * seconds and the page should notice. Then slower: a board with 116 MB of RAM
 * answering the catalogue every two seconds for eleven minutes is a load the
 * refresh it is waiting for can ill afford.
 */
export function refreshPollDelayMs(elapsedMs: number): number | null {
  if (elapsedMs >= REFRESH_GIVE_UP_MS) return null;
  if (elapsedMs < 30_000) return 2_000;
  if (elapsedMs < 120_000) return 5_000;
  return 10_000;
}

/** The parts of a source that choosing where to install from needs. */
export interface InstallSource {
  id: string;
  kind: "github" | "http" | "local";
  location: string;
  candidates: { version: string }[];
}

/** The source the daemon ships for this fork's releases. */
export const FORK_SOURCE_ID = "fork";

export interface InstallTarget {
  /** The source id to send. */
  sourceId: string;
  /**
   * Whether that source's list already has this version. When it does, the
   * install is the same act as the row's Install button; when it does not,
   * the board is being asked for a release the catalogue has not caught up
   * with, and the dialog says so.
   */
  listed: boolean;
}

/**
 * Where to install an offered version from.
 *
 * `repo` is the repository the update check resolved the version in
 * (`owner/name`). A source that is listed with that version wins, a remote one
 * before a file already on the card; failing that, the GitHub source for that
 * repository even though its list is behind; failing that, the source the
 * daemon ships for the fork.
 */
export function resolveInstallTarget(
  sources: InstallSource[],
  version: string,
  repo: string | undefined
): InstallTarget {
  const lists = (s: InstallSource) =>
    s.candidates.some((c) => c.version === version);
  const sameRepo = (s: InstallSource) =>
    s.kind === "github" && repo !== undefined && s.location === repo;

  const listed =
    sources.find((s) => lists(s) && sameRepo(s)) ??
    sources.find((s) => lists(s) && s.kind !== "local") ??
    sources.find((s) => lists(s));
  if (listed) return { sourceId: listed.id, listed: true };

  const home = sources.find(sameRepo);
  return { sourceId: home?.id ?? FORK_SOURCE_ID, listed: false };
}

/** The parts of the board's storage list that the card question needs. */
export interface StorageEntry {
  name: string;
  total_bytes: number;
  bytes_free: number;
}

/**
 * Is there an SD card in the board?
 *
 * `true` and `false` are answers; `null` is "could not be told", and the
 * caller must not treat it as either. The daemon has no field that says
 * "mounted": `type=info` lists an "SD card" entry when the device node
 * exists and `statvfs` on the mount point works. An empty mount point also
 * passes `statvfs` -- it answers for the filesystem underneath, which is the
 * BMC's own -- so an entry whose size is the BMC volume's is that, not a card.
 *
 * It is still a hint rather than proof (a card the daemon did not mount has a
 * device node), which is why the upload dialog also handles the daemon's own
 * "not mounted" refusal.
 */
export function sdCardPresent(
  storage: StorageEntry[] | null | undefined
): boolean | null {
  if (!storage) return null;
  const card = storage.find((s) => s.name === "SD card");
  if (!card) return false;
  const bmc = storage.find((s) => s.name === "BMC");
  if (bmc?.total_bytes === card.total_bytes) return false;
  return card.total_bytes > 0;
}

/**
 * Is this the daemon refusing to park because there is no card?
 *
 * The daemon's words: "/mnt/sdcard is not mounted, so there is no card to
 * park an image on. Insert one, or upload without parking to install straight
 * away." Matched on the sentence, because that is all the daemon sends.
 */
export function isNoCardRefusal(message: string | null | undefined): boolean {
  const text = message ?? "";
  return /not mounted/i.test(text) && /sdcard|\bcard\b/i.test(text);
}
