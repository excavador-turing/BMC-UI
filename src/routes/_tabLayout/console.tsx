import { createFileRoute } from "@tanstack/react-router";

/**
 * `?node=2` opens the console with that node already selected.
 *
 * The validation lives here rather than in `console.lazy.tsx` because a lazy
 * route carries only its component; search parsing has to run before the
 * chunk is fetched.
 *
 * Anything that is not 1-4 is dropped rather than rejected. A stale bookmark
 * should land on the console with nothing selected, not on an error page.
 */
export const Route = createFileRoute("/_tabLayout/console")({
  validateSearch: (search: Record<string, unknown>) => {
    const node = Number(search.node);
    return Number.isInteger(node) && node >= 1 && node <= 4 ? { node } : {};
  },
});
