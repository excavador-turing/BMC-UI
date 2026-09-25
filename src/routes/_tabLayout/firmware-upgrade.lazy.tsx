import { createLazyFileRoute } from "@tanstack/react-router";

import FirmwareCandidates from "@/components/FirmwareCandidates";
import FirmwareSlots from "@/components/FirmwareSlots";
import TabView from "@/components/TabView";

export const Route = createLazyFileRoute("/_tabLayout/firmware-upgrade")({
  component: FirmwareUpgrade,
});

/**
 * Where the board is, and what it could move to.
 *
 * Two cards: the slots and the channel on top, every installable version
 * below. The sources editor and the upload form open from the second card's
 * header -- as a sheet and a dialog -- because both are set up once and
 * rarely touched, and as cards of their own they were half of a page opened
 * to install something.
 */
export function FirmwareUpgrade() {
  return (
    <TabView>
      <FirmwareSlots />
      <FirmwareCandidates />
    </TabView>
  );
}
