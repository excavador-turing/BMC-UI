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

export type SourceKind = "github" | "http" | "local";
export type Relation = "current" | "newer" | "older" | "unknown";
export type Trust = "verified" | "tls" | "unverified";

/** A source as the catalogue lists it, down to what installing needs. */
export interface InstallSource {
  id: string;
  label: string;
  kind: SourceKind;
  location: string;
  candidates: InstallCandidate[];
}

export interface InstallCandidate {
  version: string;
  relation: Relation;
  trust: Trust;
  prerelease?: boolean;
  file?: string | null;
}

/** A configured source, which says where it points but not what it holds. */
export interface RepoSource {
  id: string;
  label: string;
  kind: SourceKind;
  location: string;
  enabled?: boolean;
}

/**
 * The source that IS the repository an update check named: a GitHub source
 * whose location is exactly `owner/name`. Nothing else will do. A version
 * string is not an identity -- another remote can list a `v2.46.1` that is a
 * different image -- so the badge installs from the repository that offered
 * it or not at all, and the page says which.
 */
export function findRepoSource<T extends RepoSource>(
  sources: T[],
  repo: string
): T | undefined {
  return sources.find(
    (s) => s.kind === "github" && s.location === repo && s.enabled !== false
  );
}

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
 * Where to install an offered version from: the source for the repository the
 * update check resolved it in, whether or not its list has the version yet.
 * Null when no source is that repository -- there is then no honest place to
 * install it from, and the caller shows the update as information only.
 */
export function resolveInstallTarget(
  sources: InstallSource[],
  version: string,
  repo: string
): InstallTarget | null {
  const home = findRepoSource(sources, repo);
  if (!home) return null;
  return {
    sourceId: home.id,
    listed: home.candidates.some((c) => c.version === version),
  };
}

/**
 * Everything the install confirmation asks about and the install then sends,
 * fixed at the moment it was chosen. The catalogue refreshes under an open
 * dialog (the page polls it while it is checking); a confirmation that
 * re-read it could ask about one thing and install another.
 */
export interface InstallSnapshot {
  sourceId: string;
  sourceLabel: string;
  sourceKind: SourceKind;
  /** `owner/name` for a GitHub source; shown, so the origin is not just an id. */
  repo: string | null;
  version: string;
  /** False when the catalogue did not list it, only the update check did. */
  listed: boolean;
  trust: Trust;
  relation: Relation;
  prerelease: boolean;
  /** Sent as `allow_downgrade`, and only ever when `relation` is not "newer". */
  allowDowngrade: boolean;
  /** For a candidate already on the card: its path. */
  localFile: string | undefined;
  /** Chosen with the update badge rather than a row. */
  viaBadge: boolean;
}

/** A row's Install button: the candidate as the list shows it. */
export function snapshotFromRow(
  source: InstallSource,
  candidate: InstallCandidate
): InstallSnapshot {
  return {
    sourceId: source.id,
    sourceLabel: source.label,
    sourceKind: source.kind,
    repo: source.kind === "github" ? source.location : null,
    version: candidate.version,
    listed: true,
    trust: candidate.trust,
    relation: candidate.relation,
    prerelease: candidate.prerelease === true,
    // Anything not strictly newer needs the updater's explicit consent.
    allowDowngrade: candidate.relation !== "newer",
    localFile:
      source.kind === "local" ? (candidate.file ?? undefined) : undefined,
    viaBadge: false,
  };
}

/** What the update badge asks for. */
export interface BadgeRequest {
  version: string;
  /** `owner/name` the update check resolved it in. */
  repo: string;
  /** The source that is that repository (see `findRepoSource`). */
  source: RepoSource;
}

/**
 * The badge's install, as the dialog will ask about it and the request will
 * send it. The update check only offers a version it judged newer than what
 * runs, so unless the list says the version is OLDER (and the dialog then
 * says so) this is an upgrade and never asks the updater to allow a
 * downgrade. A version the list does not hold is "verified" only when the
 * source is the very repository the check named; the updater checks
 * `SHA256SUMS` for a GitHub release, and for nothing else can that be said.
 */
export function snapshotFromBadge(
  request: BadgeRequest,
  catalogSources: InstallSource[]
): InstallSnapshot {
  const source = catalogSources.find((s) => s.id === request.source.id);
  const listed = source?.candidates.find((c) => c.version === request.version);
  const relation: Relation = listed?.relation === "older" ? "older" : "newer";
  const ownRepo =
    request.source.kind === "github" &&
    request.source.location === request.repo;
  return {
    sourceId: request.source.id,
    sourceLabel: source?.label ?? request.source.label,
    sourceKind: request.source.kind,
    repo: request.repo,
    version: request.version,
    listed: listed !== undefined,
    trust: listed?.trust ?? (ownRepo ? "verified" : "unverified"),
    relation,
    prerelease: listed?.prerelease === true,
    allowDowngrade: relation === "older",
    localFile: undefined,
    viaBadge: true,
  };
}

/**
 * The parts of the board's storage list that the card question needs.
 *
 * `mounted` comes from bmcd 2.42.2 and is present only on the "SD card"
 * entry: `true` with a card in, `false` without one, in which case the sizes
 * are the BMC volume's and mean nothing. It is declared here, narrowly,
 * because the generated API types are refreshed from a bmcd release's
 * document only when that release is tagged. A daemon before 2.42.2 does not
 * send it.
 */
export interface StorageEntry {
  name: string;
  total_bytes: number;
  bytes_free: number;
  mounted?: boolean;
}

/**
 * Is there an SD card in the board?
 *
 * `true` and `false` are answers; `null` is "could not be told", and the
 * caller must not treat it as either.
 *
 * From bmcd 2.42.2 the "SD card" entry says so: `mounted` is used exactly.
 * Before that the daemon had no such field. `type=info` lists the entry when
 * the device node exists and `statvfs` on the mount point works, and an empty
 * mount point also passes `statvfs` -- it answers for the filesystem
 * underneath, which is the BMC's own -- so there an entry whose size is the
 * BMC volume's is that, not a card.
 *
 * Either way it is a view of the daemon's state and not a promise about the
 * next write, which is why the upload dialog also handles the daemon's own
 * "not mounted" refusal.
 */
export function sdCardPresent(
  storage: StorageEntry[] | null | undefined
): boolean | null {
  if (!storage) return null;
  const card = storage.find((s) => s.name === "SD card");
  if (!card) return false;
  if (typeof card.mounted === "boolean") return card.mounted;
  const bmc = storage.find((s) => s.name === "BMC");
  if (bmc?.total_bytes === card.total_bytes) return false;
  return card.total_bytes > 0;
}

/**
 * The storage volumes worth drawing. An "SD card" entry with `mounted: false`
 * carries the BMC volume's sizes, so showing it would print the BMC's storage
 * a second time under the name of a card that is not there.
 */
export function visibleStorage<T extends StorageEntry>(storage: T[]): T[] {
  return storage.filter((s) => !(s.name === "SD card" && s.mounted === false));
}

/**
 * Is this the daemon refusing to park because there is no usable card?
 *
 * The daemon's words, across versions:
 * - "/mnt/sdcard is not mounted, so there is no card to park an image on.
 *   Insert one, or upload without parking to install straight away."
 * - "the image was not saved: no SD card is mounted at /mnt/sdcard ..."
 * - "an SD card is inserted but not mounted (unsupported or damaged
 *   filesystem?)"
 *
 * Matched on the sentences, because that is all the daemon sends. Other
 * failures that mention a card ("the card has 1 MB free ...") or a mount
 * that is not the card's are not this.
 */
export function isNoCardRefusal(message: string | null | undefined): boolean {
  const text = message ?? "";
  return (
    /no SD card is mounted/i.test(text) ||
    (/not mounted/i.test(text) && /sdcard|\bcard\b/i.test(text))
  );
}
