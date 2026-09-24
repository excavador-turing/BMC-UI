import { createLazyFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import SwitchSkeleton from "@/components/skeletons/network";
import SwitchConfig from "@/components/SwitchConfig";
import TabView from "@/components/TabView";

export const Route = createLazyFileRoute("/_tabLayout/switch")({
  component: Switch,
  errorComponent: () => <div>Error loading On-board Switch</div>,
  pendingComponent: SwitchSkeleton,
});

export function Switch() {
  const { t } = useTranslation();

  return (
    <TabView title={t("network.switchHeader")}>
      <SwitchConfig />
    </TabView>
  );
}
