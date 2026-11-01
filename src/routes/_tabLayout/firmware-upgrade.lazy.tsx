import { createLazyFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import FirmwareCandidates, {
  type InstallRequest,
} from "@/components/FirmwareCandidates";
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
 *
 * The "Update available" badge in the first card installs through the second:
 * the confirmation, the progress line and the refusal all live with the list,
 * so the badge only hands over the version.
 */
export function FirmwareUpgrade() {
  const [request, setRequest] = useState<InstallRequest | null>(null);

  return (
    <TabView>
      <FirmwareSlots onInstallUpdate={setRequest} />
      <FirmwareCandidates
        installRequest={request}
        onInstallRequestHandled={() => setRequest(null)}
      />
    </TabView>
  );
}
