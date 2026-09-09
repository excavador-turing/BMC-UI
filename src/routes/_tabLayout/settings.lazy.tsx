import { createLazyFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import ConfigBackup from "@/components/ConfigBackup";
import FanControl from "@/components/FanControl";
import FirmwareSources from "@/components/FirmwareSources";
import HostnameCard from "@/components/HostnameCard";
import MetricsToken from "@/components/MetricsToken";
import RebootModal from "@/components/RebootModal";
import InfoSkeleton from "@/components/skeletons/info";
import TabView from "@/components/TabView";
import TimeCard from "@/components/TimeCard";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useFirmwareSlotsQuery } from "@/lib/api/get";
import { useRebootBMCMutation, useReloadBMCMutation } from "@/lib/api/set";

export const Route = createLazyFileRoute("/_tabLayout/settings")({
  component: Settings,
  errorComponent: () => <div>Error loading Settings</div>,
  pendingComponent: InfoSkeleton,
});

/**
 * Everything that changes the board, in one place.
 *
 * Info was 1500 px of storage, health, a scrape credential, a fan slider and a
 * REBOOT button — three of those being settings or actions, and a destructive
 * reboot at the foot of an information page is the wrong neighbourhood.
 *
 * The order is identity, then behaviour, then credentials and sources, then
 * the two things that touch the whole board. Reboot is last and red for the
 * same reason it is not on Overview: you should have to arrive here on
 * purpose.
 */
export function Settings() {
  const { t } = useTranslation();
  const { toast } = useToast();
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
      onSuccess: () =>
        toast({
          title: t("info.rebootButton"),
          description: t("info.rebootSuccess"),
        }),
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
    <TabView>
      <HostnameCard />
      <TimeCard />
      <FanControl />
      <MetricsToken />
      <FirmwareSources />
      <ConfigBackup />

      <div>
        <div className="mb-6 text-lg font-bold">{t("info.bmc")}</div>
        <div className="flex gap-4">
          <Button
            type="button"
            variant="destructive"
            onClick={() => setRebootModalOpened(true)}
            isLoading={rebootPending}
            disabled={rebootPending}
          >
            {t("info.rebootButton")}
          </Button>
          <Button
            type="button"
            variant="bw"
            onClick={() => handleReloadBMC()}
            isLoading={reloadPending}
            disabled={reloadPending}
          >
            {t("info.reloadDaemonButton")}
          </Button>
        </div>
        {/* The reboot cuts the BMC, not the compute modules. People assume
            otherwise and hesitate over a button that is safe, so say it. */}
        <p className="mt-2 text-sm opacity-60">{t("settings.rebootNote")}</p>

        {/* Amber, like the same fact on the Firmware tab, and for the same
            reason: a staged update is not a fault, but it does change what
            this button does. */}
        {staged && (
          <p className="mt-2 text-sm font-semibold text-amber-700 dark:text-amber-500">
            {stagedVersion
              ? t("settings.rebootStagedNamed", { version: stagedVersion })
              : t("settings.rebootStaged")}
          </p>
        )}
      </div>

      <RebootModal
        isOpen={rebootModalOpened}
        onClose={() => setRebootModalOpened(false)}
        onReboot={handleRebootBMC}
        title={t("info.rebootModalTitle")}
        message={
          <>
            <p>{t("settings.rebootModalDescription")}</p>
            {staged && (
              <p className="mt-3 font-semibold">
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
