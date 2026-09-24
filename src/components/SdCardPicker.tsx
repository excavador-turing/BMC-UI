import { filesize } from "filesize";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
      <DialogContent className="max-h-[80vh] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("sdCard.pickerTitle")}</DialogTitle>
          <DialogDescription>
            {usage.data
              ? t("sdCard.usage", {
                  free: human(usage.data.free),
                  total: human(usage.data.total),
                })
              : t("sdCard.pickerNote")}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[52vh] overflow-y-auto">
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
            <Table>
              <TableHeader className="text-muted-foreground">
                <TableRow>
                  <TableHead>{t("sdCard.colName")}</TableHead>
                  <TableHead>{t("sdCard.colSize")}</TableHead>
                  <TableHead>{t("sdCard.colState")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((entry) => (
                  <TableRow key={entry.path}>
                    <TableCell className="font-mono break-all">
                      {entry.path}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {human(entry.size)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.flashable
                        ? t("sdCard.flashable")
                        : (entry.reason ?? t("sdCard.notFlashable"))}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!entry.flashable}
                        onClick={() => {
                          onChoose(entry);
                          onClose();
                        }}
                      >
                        {t("sdCard.choose")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          {/* Everything on the card, not only what can be flashed: an image
              the daemon rejected is exactly what an operator wants to see,
              with the reason beside it. */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAll((value) => !value)}
            disabled={!files.isSuccess}
          >
            {showAll
              ? t("sdCard.showFlashable", { count: flashableCount })
              : t("sdCard.showAll")}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("ui.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
