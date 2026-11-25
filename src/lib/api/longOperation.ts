/**
 * Whether a long operation is running, kept free of React so `npm test` can
 * run it.
 *
 * When the board is flagged as not answering and then answers again, the page
 * reloads itself: no query resumes polling after an error, so a reload is the
 * only way back (see `useBoardReconnect`). A reload while a file is being
 * uploaded, an image installed, a module flashed or an archive downloaded
 * ends that operation, and a poll that merely answered late is enough to
 * start one now that every request has a limit (`requestTimeout.ts`).
 *
 * So while any of these runs, the banner may show but the page does not
 * reload. The operation's own result decides what happens next: it reports
 * through its own toast and panel, and the reload comes once it is over.
 */

/** The mutations that are, or start, a long operation. */
export const LONG_OPERATION_MUTATIONS: readonly string[] = [
  // The firmware upload, and the install of a candidate image.
  "firmwareUpdateMutation",
  "installFirmware",
  // The upload that flashes a node.
  "nodeUpdateMutation",
  // The configuration archive download.
  "backupMutation",
];

/**
 * The progress polls that exist only while a transfer is being written to the
 * board or to a node. The upload mutation is over by then; the flash is not.
 */
export const LONG_OPERATION_QUERIES: readonly string[] = [
  "flashStatus",
  "firmwareStatus",
];

export interface MutationView {
  status: string;
  key: readonly unknown[] | undefined;
}

/**
 * @param mutations every mutation the client knows of, with its status
 * @param activeQueryKeys the keys of the queries somebody is observing
 */
export function longOperationRunning(
  mutations: readonly MutationView[],
  activeQueryKeys: readonly (readonly unknown[] | undefined)[]
): boolean {
  const named = (
    key: readonly unknown[] | undefined,
    names: readonly string[]
  ) => typeof key?.[0] === "string" && names.includes(key[0]);
  return (
    mutations.some(
      (m) => m.status === "pending" && named(m.key, LONG_OPERATION_MUTATIONS)
    ) || activeQueryKeys.some((key) => named(key, LONG_OPERATION_QUERIES))
  );
}
