import { filesize } from "filesize";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import RebootModal from "@/components/RebootModal";
import TableItem from "@/components/TableItem";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  type FirmwareSlot,
  useFirmwareSlotsQuery,
  useUpdateCheckQuery,
} from "@/lib/api/get";
import { useRebootBMCMutation } from "@/lib/api/set";
import { versionLabel } from "@/lib/format";

const human = (bytes: number) => filesize(bytes, { standard: "jedec" });
import InfoNote from "@/components/InfoNote";

/**
 * One slot's cell: the version if it can be read, and the volume behind it.
 *
 * The version is rendered as a version only when the daemon sent one. A null
 * is not an empty string and must not become one: on the rollback slot it is
 * the normal, permanent answer, because that volume is not mounted and its
 * version genuinely cannot be read from a running system. A dash there would
 * read as "the daemon forgot"; a version copied from anywhere else would be
 * a fabrication about the firmware a rollback lands on.
 *
 * The detail line is assembled from whichever parts survive a finiteness
 * check, the same way the switch panel builds its rate line. A daemon that
 * omits `volume_id` loses that fragment rather than printing "id undefined".
 */
function SlotBody({ slot }: { slot: FirmwareSlot | null }) {
  const { t } = useTranslation();

  if (slot === null) {
    return (
      <span className="opacity-60">{t("firmwareUpgrade.slotMissing")}</span>
    );
  }

  const detail = [
    slot.volume,
    Number.isFinite(slot.volume_id)
      ? t("firmwareUpgrade.slotVolumeId", { id: slot.volume_id })
      : null,
    Number.isFinite(slot.size_bytes) ? human(slot.size_bytes) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col items-end gap-0.5 lg:items-start">
      {slot.version === null || slot.version === "" ? (
        <span className="font-semibold opacity-60">
          {t("firmwareUpgrade.slotVersionUnreadable")}
        </span>
      ) : (
        <span className="font-semibold">{versionLabel(slot.version)}</span>
      )}
      {detail !== "" && <span className="text-sm opacity-60">{detail}</span>}
    </div>
  );
}

function SlotsSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex flex-row py-1">
          <div className="w-1/2 lg:w-1/4">
            <div className="h-6 w-20 animate-pulse bg-neutral-200 dark:bg-neutral-700"></div>
          </div>
          <div className="h-6 w-44 animate-pulse bg-neutral-200 dark:bg-neutral-700"></div>
        </div>
      ))}
    </div>
  );
}

/**
 * The board's A/B firmware state, on the tab that changes it.
 *
 * This board updates firmware into whichever of two root volumes is not
 * running and switches over on the next boot. The page that performs that
 * update has, until now, said nothing about which slot is running, what a
 * rollback would land on, or whether an update is already waiting for a
 * reboot -- so the one screen where those facts decide what you do next was
 * the one screen that did not have them.
 *
 * Four things are shown and they answer four different questions:
 *
 * - **running** -- the version this BMC is executing right now, which is the
 *   same string the header prints and is here so the two can be compared
 *   against what you are about to upload.
 * - **rollback** -- the volume a rollback lands on, with its version left
 *   deliberately unread; see `SlotBody`.
 * - **update staged** -- whether a reboot will switch slots. Three-valued,
 *   because "the environment could not be read" is not "no".
 * - **last promotion** -- the boot-time health gate's own verdict. A board
 *   that came up, failed its own checks and put itself back on the previous
 *   firmware reports that here and in no other place this interface can see.
 *
 * The panel sits above the upload form rather than below it: it describes
 * where the board is, and the form is what changes that.
 */
export default function FirmwareSlots() {
  const { t } = useTranslation();
  const { data, isPending, isError } = useFirmwareSlotsQuery();
  const update = useUpdateCheckQuery();

  const promotion = data?.last_promotion ?? null;
  const { toast } = useToast();
  const [rebootModalOpened, setRebootModalOpened] = useState(false);
  const { mutate: mutateRebootBMC, isPending: rebootPending } =
    useRebootBMCMutation();

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

  return (
    <div>
      <div className="mb-6 text-lg font-bold">
        {t("firmwareUpgrade.firmwareSlots")}
      </div>

      {isPending && <SlotsSkeleton />}

      {isError && (
        <p className="text-sm opacity-60">
          {t("firmwareUpgrade.slotsUnavailable")}
        </p>
      )}

      {data && !data.present && (
        <p className="text-sm opacity-60">{t("firmwareUpgrade.slotsAbsent")}</p>
      )}

      {data?.present && (
        <>
          {/* Amber, and above the rows, because it is the one fact here that
              changes what the next reboot does. Not red: a staged update is
              the expected end of a successful upload, and an interface that
              cries fault at its own success teaches people to ignore it. */}
          {data.update_staged === true && (
            <div className="mb-6 flex items-start gap-3 rounded-md border border-amber-500 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
              <TriangleAlert className="mt-0.5 size-5 shrink-0" />
              <div className="text-sm">
                <p className="font-semibold">
                  {t("firmwareUpgrade.slotStagedTitle")}
                </p>
                <p className="mt-1">
                  {data.staged?.version
                    ? t("firmwareUpgrade.slotStagedDescriptionNamed", {
                        version: data.staged.version,
                      })
                    : t("firmwareUpgrade.slotStagedDescription")}
                </p>
                {/* The one action this notice implies, next to the notice.
                    Until now it lived on another page: install here, then go
                    to Settings to reboot -- and the two are one operation, so
                    people either forgot or rebooted from the wrong place. */}
                <Button
                  className="mt-3"
                  type="button"
                  variant="destructive"
                  size="sm"
                  isLoading={rebootPending}
                  disabled={rebootPending}
                  onClick={() => setRebootModalOpened(true)}
                >
                  {t("firmwareUpgrade.rebootToApply")}
                </Button>
              </div>
            </div>
          )}

          <dl>
            <TableItem term={t("firmwareUpgrade.slotRunning")}>
              <SlotBody slot={data.running} />
            </TableItem>
            <TableItem term={t("firmwareUpgrade.slotRollback")}>
              <SlotBody slot={data.rollback} />
            </TableItem>
            {data.nextboot !== null && data.nextboot !== "" && (
              <TableItem term={t("firmwareUpgrade.slotNextboot")}>
                <span className="font-semibold">{data.nextboot}</span>
              </TableItem>
            )}
            <TableItem term={t("firmwareUpgrade.slotStaged")}>
              {data.update_staged === true && (
                <span className="font-semibold text-amber-600 dark:text-amber-500">
                  {t("firmwareUpgrade.slotStagedYes")}
                </span>
              )}
              {data.update_staged === false && (
                <span className="font-semibold">
                  {t("firmwareUpgrade.slotStagedNo")}
                </span>
              )}
              {data.update_staged === null && (
                <span className="opacity-60">
                  {t("firmwareUpgrade.slotStagedUnknown")}
                </span>
              )}
            </TableItem>
            {/* Only when something was actually recorded. `update_staged`
                true with no note means an image was armed by something that
                writes none -- an older tpi-selfupdate, or a hand-run
                osupdate -- and an empty row would read as "nothing is
                staged", which is the opposite of the truth. */}
            {data.staged && (
              <TableItem term={t("firmwareUpgrade.slotStagedVersion")}>
                <div className="flex flex-col items-end gap-0.5 lg:items-start">
                  <span className="font-semibold">
                    {data.staged.version ??
                      data.staged.file ??
                      t("firmwareUpgrade.slotStagedUnnamed")}
                  </span>
                  {data.staged.staged_at && (
                    <span className="text-sm opacity-60">
                      {data.staged.staged_at}
                      {data.staged.source ? ` · ${data.staged.source}` : ""}
                    </span>
                  )}
                </div>
              </TableItem>
            )}
            {/* The upgrade candidate. Its own query, so a slow or failing
                check never holds up the slot panel above -- and a channel that
                could not be resolved says so, rather than rendering as "no
                update", which is a different claim. */}
            {update.data?.stable && (
              <TableItem term={t("firmwareUpgrade.updateStable")}>
                <div className="flex flex-col items-end gap-0.5 lg:items-start">
                  <span
                    className={
                      update.data.stable.update_available
                        ? "font-semibold text-amber-600 dark:text-amber-500"
                        : "font-semibold"
                    }
                  >
                    {update.data.stable.target}
                  </span>
                  <span className="text-sm opacity-60">
                    {update.data.stable.update_available
                      ? t("firmwareUpgrade.updateAvailable")
                      : t("firmwareUpgrade.updateCurrent")}
                  </span>
                </div>
              </TableItem>
            )}
            {update.data?.edge &&
              update.data.edge.target !== update.data.stable?.target && (
                <TableItem term={t("firmwareUpgrade.updateEdge")}>
                  <span className="font-semibold">
                    {update.data.edge.target}
                  </span>
                </TableItem>
              )}
            {update.data?.error && (
              <TableItem term={t("firmwareUpgrade.updateCheck")}>
                <span className="text-sm opacity-60">
                  {t("firmwareUpgrade.updateUnavailable")}
                </span>
              </TableItem>
            )}
            {promotion && (
              <TableItem term={t("firmwareUpgrade.slotPromotion")}>
                <div className="flex flex-col items-end gap-0.5 lg:items-start">
                  <span className="font-semibold">{promotion.message}</span>
                  <span className="text-sm opacity-60">
                    {promotion.timestamp}
                  </span>
                </div>
              </TableItem>
            )}
          </dl>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm opacity-60">
            <span className="inline-flex items-center gap-1">
              {t("firmwareUpgrade.slotRollback")}
              <InfoNote
                text={t("firmwareUpgrade.slotRollbackNote")}
                path="/features/updates-that-undo-themselves/"
                label={t("firmwareUpgrade.slotRollback")}
              />
            </span>
            {promotion && (
              <span className="inline-flex items-center gap-1">
                {t("firmwareUpgrade.slotPromotion")}
                <InfoNote
                  text={t("firmwareUpgrade.slotPromotionNote")}
                  path="/reference/gate-history/"
                  label={t("firmwareUpgrade.slotPromotion")}
                />
              </span>
            )}
          </div>
        </>
      )}

      <RebootModal
        isOpen={rebootModalOpened}
        onClose={() => setRebootModalOpened(false)}
        onReboot={handleRebootBMC}
        title={t("firmwareUpgrade.rebootToApply")}
        message={t("firmwareUpgrade.rebootToApplyConfirm")}
      />
    </div>
  );
}
