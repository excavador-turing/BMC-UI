/**
 * Where the fleet is, kept in the URL hash.
 *
 * Not TanStack Router, and not a choice made lightly. `src/router.tsx` exports
 * a module-level singleton and `app.tsx` registers its type globally through
 * `declare module`, so there is exactly one router in a build and it belongs
 * to the board application. The fleet needs a *board* and a *tab*, and it
 * renders the board application's own tab components underneath -- some of
 * which would call into a router that is not theirs.
 *
 * The hash is the small honest answer. It is linkable, the back button works,
 * and it costs no dependency and no global.
 *
 *   #/                      the overview
 *   #/bmc-1                 that board, on its first tab
 *   #/bmc-1/nodes           that board, on Nodes
 *   #/bmc-1/console?node=3  that board's console, module 3 selected
 */

export interface FleetRoute {
  /** `null` on the overview. */
  board: string | null;
  /** Which tab of that board. Meaningless when `board` is null. */
  tab: string;
  /** `?node=` for the two tabs that take one. */
  node?: number;
}

export const OVERVIEW: FleetRoute = { board: null, tab: "" };

/** The hash as it stands now. Unrecognised shapes fall back to the overview
 *  rather than erroring: a stale link should land somewhere, not nowhere. */
export function parseHash(hash: string): FleetRoute {
  const raw = hash.replace(/^#\/?/, "");
  if (raw === "") return OVERVIEW;

  const [path, query] = raw.split("?", 2);
  const [board, tab] = path.split("/");
  if (!board) return OVERVIEW;

  let node: number | undefined;
  if (query) {
    const parsed = Number(new URLSearchParams(query).get("node"));
    // 1..4, and anything else is dropped rather than rejected -- the board
    // application's own routes take exactly this line.
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 4) node = parsed;
  }

  return { board: decodeURIComponent(board), tab: tab ?? "", node };
}

/** The hash for a route, ready to assign to `location.hash`. */
export function toHash(route: FleetRoute): string {
  if (!route.board) return "#/";
  const base = `#/${encodeURIComponent(route.board)}${route.tab ? `/${route.tab}` : ""}`;
  return route.node ? `${base}?node=${String(route.node)}` : base;
}
