import { createLazyFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import AddressCard from "@/components/AddressCard";
import ConfirmationModal from "@/components/ConfirmationModal";
import HostnameCard from "@/components/HostnameCard";
import NetworkSkeleton from "@/components/skeletons/network";
import SwitchConfig from "@/components/SwitchConfig";
import TabView from "@/components/TabView";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useInfoTabData } from "@/lib/api/get";
import { useNetworkResetMutation } from "@/lib/api/set";

export const Route = createLazyFileRoute("/_tabLayout/network")({
  component: Network,
  errorComponent: () => <div>Error loading Network</div>,
  pendingComponent: NetworkSkeleton,
});

/**
 * How the board is connected.
 *
 * These two panels were the second half of the Info page, which had grown to
 * six sections and answered two unrelated questions at once: what condition
 * the board is in, and how it is wired. Storage, health, the fan and the
 * reboot buttons stayed there; the addresses and the switch came here,
 * because a person looking for one of them is not looking for the other.
 *
 * The addresses come from `type=info`, the same endpoint and the same cached
 * query the Info page reads for its storage volumes -- `useInfoTabData` is
 * named for the endpoint, not for the page, and both routes share one entry
 * in the query cache rather than fetching twice. Reset Network invalidates
 * that key, so the Info page's storage rows stay current whichever tab the
 * reset was pressed from.
 */
export function Network() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data } = useInfoTabData();
  const [confirmReset, setConfirmReset] = useState(false);
  const { mutate: mutateResetNetwork, isPending: resetNetworkPending } =
    useNetworkResetMutation();

  const handleResetNetwork = () => {
    mutateResetNetwork(undefined, {
      onSuccess: () => {
        toast({
          title: t("network.resetSwitchButton"),
          description: t("network.resetNetworkSuccess"),
        });
      },
      onError: (e) => {
        toast({
          title: t("network.resetSwitchButton"),
          description: e.message,
          variant: "destructive",
        });
      },
    });
  };

  return (
    <TabView title={t("network.header")} columns>
      {/* What this board is called and where it answers, together. The name
          IS a network fact: it is how somebody reaches the board, it is in
          the certificate's subject-alternative names, and it is the mDNS
          name. It used to live on a different tab from the addresses it
          belongs with. */}
      <div>
        <HostnameCard />
        <AddressCard />

        <div className="mt-8 mb-4 text-lg font-bold">
          {t("network.networkInterfaces")}
        </div>
        {/* One row per interface, not three. The device, its address and its
            MAC are one fact about one thing, and three definition rows each
            spent 150 px saying so. */}
        <div className="space-y-2">
          {data.ip.map((ip) => (
            <div
              key={ip.device}
              className="flex flex-wrap items-baseline gap-x-4 text-sm"
            >
              <span className="w-16 shrink-0 font-semibold">{ip.device}</span>
              <span className="font-mono">{ip.ip}</span>
              <span className="font-mono opacity-60">{ip.mac}</span>
            </div>
          ))}
        </div>
        <div className="mt-4">
          {/* Red, not lime. One rule across the interface: lime is safe to
              press, red is consequential and confirms first. This resets the
              switch CHIP -- every port drops for a moment -- and used to be
              labelled "Reset network", which read as the address. The
              address has its own card above, with a confirm window. */}
          <Button
            type="button"
            variant="destructive"
            onClick={() => setConfirmReset(true)}
            isLoading={resetNetworkPending}
            disabled={resetNetworkPending}
          >
            {t("network.resetSwitchButton")}
          </Button>
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          handleResetNetwork();
        }}
        title={t("network.resetSwitchButton")}
        message={t("network.resetSwitchConfirm")}
      />

      {/* One panel, not two. Link state and VLAN membership are facts about
          the same seven ports, and answering "is node 3's cable in, and which
          network is it on" used to mean matching names between two tables. */}
      <div>
        <SwitchConfig />
      </div>
    </TabView>
  );
}
