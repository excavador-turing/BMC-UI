import { createLazyFileRoute } from "@tanstack/react-router";

import FanControl from "@/components/FanControl";
import InfoSkeleton from "@/components/skeletons/info";
import TabView from "@/components/TabView";

export const Route = createLazyFileRoute("/_tabLayout/cooling")({
  component: Cooling,
  errorComponent: () => <div>Error loading Cooling</div>,
  pendingComponent: InfoSkeleton,
});

/**
 * The fan, and the sensors it answers to.
 *
 * It was a card on Settings, between the clock and the backup: a cooling tool
 * among housekeeping, on a page nobody opens to find out why the board is
 * loud. It is its own page now, beside the board's other hardware.
 */
export function Cooling() {
  return (
    <TabView>
      <FanControl />
    </TabView>
  );
}
