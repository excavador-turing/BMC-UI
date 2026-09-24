import { createLazyFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import ConfigBackup from "@/components/ConfigBackup";
import FanControl from "@/components/FanControl";
import LoadingButton from "@/components/LoadingButton";
import RebootModal from "@/components/RebootModal";
import InfoSkeleton from "@/components/skeletons/info";
import TabView from "@/components/TabView";
import TimeCard from "@/components/TimeCard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useConnection } from "@/hooks/useConnection";
import { useFirmwareSlotsQuery } from "@/lib/api/get";
import { useRebootBMCMutation, useReloadBMCMutation } from "@/lib/api/set";

export const Route = createLazyFileRoute("/_tabLayout/settings")({
  component: Settings,
  errorComponent: () => <div>Error loading Settings</div>,
  pendingComponent: InfoSkeleton,
});

/**
 * Everything that changes the board and is not about who may reach it.
 *
 * Info was 1500 px of storage, health, a scrape credential, a fan slider and a
 * REBOOT button — three of those being settings or actions, and a destructive
 * reboot at the foot of an information page is the wrong neighbourhood. So
 * they came here.
 *
 * Then this page reached seven cards and 3014 px. The name, the password, the
 * trusted proxy and the certificate went to Access, which is where somebody
 * looks for them. Firmware sources went nowhere: it was rendered on BOTH this
 * tab and Firmware, the same editor twice, and it only ever belonged on the
 * one where the sources are used.
 *
 * What is left is time, the fan, backup and restore, and the two buttons that
 * touch the whole board. Reboot is last and red for the same reason it is not
 * on Overview: you should have to arrive here on purpose.
 */
export function Settings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { expectReboot } = useConnection();
  const [rebootModalOpened, setRebootModalOpened] = useState(false);
  const { mutate: mutateRebootBMC, isPending: rebootPending } =
    useRebootBMCMutation();

  // A reboot from here applies a staged firmware just as surely as the button
  // on the Firmware tab does, and until now this page said nothing about it:
  // you could reboot for an unrelated reason and silently take an update you
  // had forgotten was waiting. `update_staged` is three-valued, so only an
  // explicit `true` warns -- "the boot environment could not be read" is not
  // a reason to claim an update is pending.
  const slots = useFirmwareSlotsQuery();
  const stagedVersion = slots.data?.staged?.version ?? null;
  const staged = slots.data?.update_staged === true;
  const { mutate: mutateReloadBMC, isPending: reloadPending } =
    useReloadBMCMutation();

  const handleRebootBMC = () => {
    setRebootModalOpened(false);
    mutateRebootBMC(undefined, {
      // Named before the queries start failing, so the banner says "the board
      // is rebooting, about 48 seconds" rather than "the connection was
      // lost". The difference is whether the page can offer a number.
      onSuccess: () => {
        expectReboot();
        toast({
          title: t("info.rebootButton"),
          description: t("info.rebootSuccess"),
        });
      },
      onError: (e) =>
        toast({
          title: t("info.rebootFailed"),
          description: e.message,
          variant: "destructive",
        }),
    });
  };

  const handleReloadBMC = () => {
    mutateReloadBMC(undefined, {
      onSuccess: () =>
        toast({
          title: t("info.reloadDaemonButton"),
          description: t("info.reloadDaemonSuccess"),
        }),
      onError: (e) =>
        toast({
          title: t("info.reloadDaemonFailed"),
          description: e.message,
          variant: "destructive",
        }),
    });
  };

  return (
    <TabView columns>
      <TimeCard />
      <FanControl />
      <ConfigBackup />

      <Card>
        <CardHeader>
          <CardTitle>{t("info.bmc")}</CardTitle>
          {/* The reboot cuts the BMC, not the compute modules. People assume
              otherwise and hesitate over a button that is safe, so say it. */}
          <CardDescription>{t("settings.rebootNote")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <LoadingButton
              type="button"
              variant="destructive"
              onClick={() => setRebootModalOpened(true)}
              isLoading={rebootPending}
            >
              {t("info.rebootButton")}
            </LoadingButton>
            <LoadingButton
              type="button"
              variant="outline"
              onClick={() => handleReloadBMC()}
              isLoading={reloadPending}
            >
              {t("info.reloadDaemonButton")}
            </LoadingButton>
          </div>

          {/* Amber, like the same fact on the Firmware tab, and for the same
              reason: a staged update is not a fault, but it does change what
              this button does. */}
          {staged && (
            <p className="text-sm font-medium text-warning">
              {stagedVersion
                ? t("settings.rebootStagedNamed", { version: stagedVersion })
                : t("settings.rebootStaged")}
            </p>
          )}
        </CardContent>
      </Card>

      <RebootModal
        isOpen={rebootModalOpened}
        onClose={() => setRebootModalOpened(false)}
        onReboot={handleRebootBMC}
        title={t("info.rebootModalTitle")}
        message={
          <>
            <p>{t("settings.rebootModalDescription")}</p>
            {staged && (
              <p className="mt-3 font-medium">
                {stagedVersion
                  ? t("settings.rebootStagedNamed", { version: stagedVersion })
                  : t("settings.rebootStaged")}
              </p>
            )}
          </>
        }
      />
    </TabView>
  );
}
