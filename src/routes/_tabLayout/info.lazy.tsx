import { createLazyFileRoute } from "@tanstack/react-router";
import { filesize } from "filesize";
import { useTranslation } from "react-i18next";

import BoardHealth from "@/components/BoardHealth";
import NodeTiles from "@/components/dashboard/NodeTiles";
import InfoSkeleton from "@/components/skeletons/info";
import TabView from "@/components/TabView";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import UsageBar from "@/components/UsageBar";
import { useInfoTabData } from "@/lib/api/get";

/**
 * Calculates the progress data based on the total bytes and free bytes.
 *
 * @param totalBytes - The total number of bytes.
 * @param freeBytes - The number of free bytes.
 * @returns An object containing the human-readable used bytes, total bytes, and used percentage.
 */
const progressData = (totalBytes: number, freeBytes: number) => {
  const usedBytes = totalBytes - freeBytes;
  const usedPct = (usedBytes / totalBytes) * 100;

  return {
    usedHuman: filesize(usedBytes, { standard: "jedec" }),
    totalHuman: filesize(totalBytes, { standard: "jedec" }),
    usedPct: Math.round(usedPct),
  };
};

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
 * whether it is on, and since when -- and below them the board's details
 * and its storage.
 */
export function Info() {
  const { t } = useTranslation();
  const { data } = useInfoTabData();

  return (
    <TabView>
      <div className="@container/main flex flex-col gap-4 md:gap-6">
        <NodeTiles />

        <div className="grid gap-4 md:gap-6 xl:grid-cols-3 xl:items-start">
          <div id="health" className="scroll-mt-4 xl:col-span-2">
            <BoardHealth />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{t("info.userStorage")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {data.storage.map((storage) => {
                const { usedPct, usedHuman, totalHuman } = progressData(
                  storage.total_bytes,
                  storage.bytes_free
                );
                return (
                  <div key={storage.name} className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">{storage.name}</span>
                    <UsageBar
                      aria-label={t("info.ariaStorageUtilization")}
                      value={usedPct}
                      label={`${usedHuman} / ${totalHuman}`}
                      warningOnHigh
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </TabView>
  );
}
