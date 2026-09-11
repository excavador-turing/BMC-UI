/**
 * The fleet's runtime configuration, fetched rather than compiled in.
 *
 * The bundle is static and shipped as one immutable image; which boards exist
 * is an estate fact that changes when somebody racks hardware. Baking the list
 * into the bundle would mean rebuilding and republishing an image to add a
 * board, so the chart writes this file into the pod instead and the browser
 * reads it at boot.
 */
export interface FleetBoard {
  /** Path segment Envoy routes on: `/boards/<id>/api`. Also the display name. */
  id: string;
  /** What to call it in the interface. Defaults to the id. */
  name?: string;
  /** Free text: where it is, what it holds. Shown under the name. */
  note?: string;
}

export interface FleetConfig {
  boards: FleetBoard[];
  /**
   * The bmcd releases this build is known to work against. A board outside
   * the range gets a banner, not a broken page -- the fleet talks to boards
   * on different firmware by design, so "unsupported" has to be a thing it
   * can say rather than a thing it crashes on.
   */
  supportedBmcd?: { min?: string; max?: string };
}

export const EMPTY_CONFIG: FleetConfig = { boards: [] };

/** `/boards/<id>/api` — what Envoy routes to that board, with the client cert. */
export function apiBaseFor(board: FleetBoard): string {
  return `${import.meta.env.BASE_URL}boards/${board.id}/api`.replace(
    /\/{2,}/g,
    "/"
  );
}

export async function loadConfig(): Promise<FleetConfig> {
  const url = `${import.meta.env.BASE_URL}config.json`.replace(/\/{2,}/g, "/");
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}`);
  }
  const parsed = (await response.json()) as FleetConfig;
  if (!Array.isArray(parsed.boards)) {
    throw new Error(`${url} has no boards array`);
  }
  return parsed;
}

/** -1, 0, 1. Numeric per component, because "2.10.0" sorts below "2.9.0". */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) =>
    v
      .replace(/^v/, "")
      .split(/[.+-]/)
      .map((n) => Number.parseInt(n, 10));
  const left = parts(a);
  const right = parts(b);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const l = left[i];
    const r = right[i];
    if (Number.isNaN(l) || l === undefined)
      return Number.isNaN(r) || r === undefined ? 0 : -1;
    if (Number.isNaN(r) || r === undefined) return 1;
    if (l !== r) return l < r ? -1 : 1;
  }
  return 0;
}

/** Why this board is out of range, or null when it is fine or unknowable. */
export function outOfRange(
  version: string | null | undefined,
  range: FleetConfig["supportedBmcd"]
): string | null {
  if (!version || !range) return null;
  if (range.min && compareVersions(version, range.min) < 0) {
    return `bmcd ${version} is older than the ${range.min} this build was tested against`;
  }
  if (range.max && compareVersions(version, range.max) > 0) {
    return `bmcd ${version} is newer than the ${range.max} this build was tested against`;
  }
  return null;
}
