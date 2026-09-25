import { Suspense } from "react";

import ErrorBoundary from "@/components/ErrorBoundary";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
      {/* One row that scrolls rather than one that wraps: ten tabs wrapped to
          four lines at 390px. A wrapped row also moves every tab sideways
          when one is added, which is how somebody ends up on Settings having
          aimed at Network. */}
      <Tabs
        value={active}
        onValueChange={(next: string) => {
          go({ board: board.id, tab: next });
        }}
        className="mb-4 overflow-x-auto border-b pb-2"
      >
        <TabsList variant="line">
          {FLEET_TABS.map((entry) => (
            <TabsTrigger key={entry.id} value={entry.id}>
              {entry.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Per tab, not per board: a tab that throws should cost that tab, and
          the board's other tabs stay reachable from the bar above. */}
      <ErrorBoundary
        key={`${board.id}:${active}`}
        label={`fleet:${board.id}:${active}`}
        fallback={
          <p className="text-sm text-destructive">
            This tab could not be shown for {board.name ?? board.id}. The board
            may be rebooting, or off the management network.
          </p>
        }
      >
        <Suspense
          fallback={
            <p className="text-sm text-muted-foreground">
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
