import { filesize } from "filesize";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type SdCardEntry,
  useSdCardFilesQuery,
  useSdCardQuery,
} from "@/lib/api/get";
import { EMPTY_VALUE } from "@/lib/format";

/**
 * `filesize` throws "Invalid number" on anything that is not one, and the
 * board's listing has optional sizes. A size it will not state is a dash,
 * never a blank tab.
 */
const human = (bytes: number | null | undefined) =>
  typeof bytes === "number" && Number.isFinite(bytes)
    ? filesize(bytes, { standard: "jedec" })
    : EMPTY_VALUE;

/**
 * Pick an image off the board's own SD card.
 *
 * The card is where images already are on a board that has been used: staged
 * firmware lands there, and an operator with physical access writes to it
 * directly. Before this, installing one of them meant typing its path from
 * memory into a field labelled "File (remote or local)" -- and the flash
 * refused, some minutes later, if the path was wrong.
 *
 * WHAT IS FLASHABLE IS THE DAEMON'S CALL, not this component's. Every row
 * shows `flashable` and, when it is false, the daemon's own `reason`. A
 * filename check here would disagree with the board the moment either side
 * changed, and the disagreement would surface as a refusal after the operator
 * had already committed.
 */
export default function SdCardPicker({
  isOpen,
  onClose,
  onChoose,
}: {
  isOpen: boolean;
  onClose: () => void;
  onChoose: (entry: SdCardEntry) => void;
}) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const files = useSdCardFilesQuery(isOpen);
  const usage = useSdCardQuery(isOpen);

  const rows = useMemo(() => {
    const all = (files.data ?? []).filter((entry) => !entry.directory);
    const listed = showAll ? all : all.filter((entry) => entry.flashable);
    // Directory first, then name, so the order is the card's shape rather
    // than whatever order the daemon walked it in.
    return [...listed].sort((a, b) => a.path.localeCompare(b.path));
  }, [files.data, showAll]);

  const flashableCount = (files.data ?? []).filter(
    (entry) => entry.flashable
  ).length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="modal-rounded max-h-[80vh] overflow-hidden p-6 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="mb-2">{t("sdCard.pickerTitle")}</DialogTitle>
          <DialogDescription>
            {usage.data
              ? t("sdCard.usage", {
                  free: human(usage.data.free),
                  total: human(usage.data.total),
                })
              : t("sdCard.pickerNote")}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 max-h-[52vh] overflow-y-auto">
          {files.isPending && (
            <div className="py-6 text-sm">{t("sdCard.loading")}</div>
          )}

          {/* A daemon older than 2.34.0 has no listing endpoint. Saying which
              version is missing is the difference between a bug report and an
              upgrade. */}
          {files.isError && (
            <div className="py-6 text-sm">{t("sdCard.unavailable")}</div>
          )}

          {files.isSuccess && rows.length === 0 && (
            <div className="py-6 text-sm">
              {showAll ? t("sdCard.empty") : t("sdCard.noneFlashable")}
            </div>
          )}

          {rows.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-neutral-500 dark:text-neutral-400">
                <tr>
                  <th className="py-1 pr-2 font-semibold">
                    {t("sdCard.colName")}
                  </th>
                  <th className="py-1 pr-2 font-semibold">
                    {t("sdCard.colSize")}
                  </th>
                  <th className="py-1 pr-2 font-semibold">
                    {t("sdCard.colState")}
                  </th>
                  <th className="py-1" />
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => (
                  <tr
                    key={entry.path}
                    className="border-t border-neutral-200 dark:border-neutral-700"
                  >
                    <td className="py-2 pr-2 font-mono break-all">
                      {entry.path}
                    </td>
                    <td className="py-2 pr-2 whitespace-nowrap tabular-nums">
                      {human(entry.size)}
                    </td>
                    <td className="py-2 pr-2 text-neutral-500 dark:text-neutral-400">
                      {entry.flashable
                        ? t("sdCard.flashable")
                        : (entry.reason ?? t("sdCard.notFlashable"))}
                    </td>
                    <td className="py-2 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="bw"
                        disabled={!entry.flashable}
                        onClick={() => {
                          onChoose(entry);
                          onClose();
                        }}
                      >
                        {t("sdCard.choose")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between">
          {/* Everything on the card, not only what can be flashed: an image
              the daemon rejected is exactly what an operator wants to see,
              with the reason beside it. */}
          <Button
            type="button"
            variant="bw"
            size="sm"
            onClick={() => setShowAll((value) => !value)}
            disabled={!files.isSuccess}
          >
            {showAll
              ? t("sdCard.showFlashable", { count: flashableCount })
              : t("sdCard.showAll")}
          </Button>
          <Button type="button" variant="bw" onClick={onClose}>
            {t("ui.cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
