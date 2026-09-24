import { createLazyFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import AddressCard from "@/components/AddressCard";
import ConfirmationModal from "@/components/ConfirmationModal";
import HostnameCard from "@/components/HostnameCard";
import LoadingButton from "@/components/LoadingButton";
import NetworkSkeleton from "@/components/skeletons/network";
import TabView from "@/components/TabView";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
    <TabView title={t("network.header")}>
      {/* What this board is called and where it answers, together. The name
          IS a network fact: it is how somebody reaches the board, it is in
          the certificate's subject-alternative names, and it is the mDNS
          name. It used to live on a different tab from the addresses it
          belongs with. */}
      <div className="grid gap-6 md:grid-cols-2">
        <HostnameCard />
        <Card>
          <CardHeader>
            <CardTitle>{t("network.networkInterfaces")}</CardTitle>
            {/* Red: consequential, and it confirms first. This resets the
                switch CHIP -- every port drops for a moment -- and used to be
                labelled "Reset network", which read as the address. The
                address has its own card above, with a confirm window. */}
            <CardAction>
              <LoadingButton
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setConfirmReset(true)}
                isLoading={resetNetworkPending}
              >
                {t("network.resetSwitchButton")}
              </LoadingButton>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("network.interface")}</TableHead>
                    <TableHead>{t("network.ipAddress")}</TableHead>
                    <TableHead>{t("network.macAddress")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.ip.map((ip) => (
                    <TableRow key={ip.device}>
                      <TableCell className="font-medium">{ip.device}</TableCell>
                      <TableCell className="font-mono">{ip.ip}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {ip.mac}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        <div className="md:col-span-2">
          <AddressCard />
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
    </TabView>
  );
}
