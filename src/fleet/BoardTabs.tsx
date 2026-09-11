import { Suspense } from "react";

import ErrorBoundary from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { type FleetBoard } from "@/fleet/config";
import { type FleetRoute } from "@/fleet/route";
import { DEFAULT_TAB, findTab, FLEET_TABS } from "@/fleet/tabs";

/**
 * One board, with every tab the board's own interface has.
 *
 * The tabs are the SAME components, imported from the board application's
 * route files rather than reimplemented. A control that exists once behaves
 * the same in both places and cannot drift into a worse copy; the cost is that
 * those components had to stop assuming a router above them, which is what
 * `NodeNavContext` and the `preselected` props are for.
 */
export function BoardTabs({
  board,
  route,
  go,
}: {
  board: FleetBoard;
  route: FleetRoute;
  go: (next: FleetRoute) => void;
}) {
  const active = route.tab || DEFAULT_TAB;
  const tab = findTab(active);

  return (
    <div>
      <nav className="mb-6 flex flex-wrap gap-1 border-b border-neutral-200 pb-2 dark:border-neutral-700">
        {FLEET_TABS.map((entry) => (
          <Button
            key={entry.id}
            size="sm"
            variant={entry.id === active ? "turing-green" : "bw"}
            onClick={() => {
              go({ board: board.id, tab: entry.id });
            }}
          >
            {entry.label}
          </Button>
        ))}
      </nav>

      {/* Per tab, not per board: a tab that throws should cost that tab, and
          the board's other tabs stay reachable from the bar above. */}
      <ErrorBoundary
        key={`${board.id}:${active}`}
        label={`fleet:${board.id}:${active}`}
        fallback={
          <p className="text-sm text-red-700 dark:text-red-400">
            This tab could not be shown for {board.name ?? board.id}. The board
            may be rebooting, or off the management network.
          </p>
        }
      >
        <Suspense
          fallback={
            <p className="text-sm text-neutral-500">
              Reaching {board.name ?? board.id}…
            </p>
          }
        >
          <tab.Component preselected={tab.takesNode ? route.node : undefined} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
