import { createLazyFileRoute } from "@tanstack/react-router";

import AboutCard from "@/components/AboutCard";
import BoardHealth from "@/components/BoardHealth";
import NodeTiles from "@/components/dashboard/NodeTiles";
import InfoSkeleton from "@/components/skeletons/info";
import TabView from "@/components/TabView";

export const Route = createLazyFileRoute("/_tabLayout/info")({
  component: Info,
  errorComponent: () => <div>Error loading Dashboard</div>,
  pendingComponent: InfoSkeleton,
});

/**
 * The Dashboard: the page a person lands on, answering "is the board all
 * right" before any other question is asked.
 *
 * Kept simple: dashboard-01's section cards, one per module -- its name,
 * whether it is on, and since when -- and below them the board's details,
 * its storage included.
 */
export function Info() {
  return (
    <TabView>
      <div className="@container/main flex flex-col gap-4 md:gap-6">
        <NodeTiles />

        <div className="grid gap-4 md:gap-6 xl:grid-cols-2 xl:items-start">
          <div id="health" className="scroll-mt-4">
            <BoardHealth />
          </div>
          <AboutCard />
        </div>
      </div>
    </TabView>
  );
}
