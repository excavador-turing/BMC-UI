import { createFileRoute } from "@tanstack/react-router";

/**
 * `?node=2` opens the flash form with that node already chosen.
 *
 * Same shape as the console route, and for the same reason: a lazy route
 * carries only its component, and the search has to parse before the chunk
 * loads. An out-of-range node is dropped, not rejected — a stale link should
 * land on the page with nothing chosen rather than on an error.
 */
export const Route = createFileRoute("/_tabLayout/flash-node")({
  validateSearch: (search: Record<string, unknown>) => {
    const node = Number(search.node);
    return Number.isInteger(node) && node >= 1 && node <= 4 ? { node } : {};
  },
});
