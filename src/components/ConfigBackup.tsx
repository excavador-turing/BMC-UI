import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import ConfirmationModal from "@/components/ConfirmationModal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAxiosWithAuth } from "@/lib/api/_core";
import { type ImportReport, useImportConfigMutation } from "@/lib/api/set";

/**
 * Move a board's settings to a file, and back onto a board.
 *
 * Board B is a named milestone and the first thing anyone will want is "make
 * it like board A". Today that is five settings re-entered by hand plus a
 * metrics token re-pasted into a scrape config.
 *
 * Two things this deliberately does not hide. Including the metrics token
 * makes the file a credential — it can scrape any board it is applied to — so
 * that is an explicit choice with the consequence written next to it, not a
 * default. And an import is not transactional: a hostname and a set of
 * firmware sources cannot be rolled back together, so the result is reported
 * per field rather than as one verdict that would hide a half-applied board.
 */
export default function ConfigBackup() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const api = useAxiosWithAuth();
  const importConfig = useImportConfigMutation();

  const [withSecrets, setWithSecrets] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const doExport = async () => {
    setExporting(true);
    try {
      const response = await api.get<{ response: { result: unknown }[] }>(
        "/bmc",
        {
          params: {
            opt: "get",
            type: "config",
            ...(withSecrets ? { secrets: 1 } : {}),
          },
        }
      );
      const document = JSON.stringify(
        response.data.response[0].result,
        null,
        2
      );
      const blob = new Blob([document + "\n"], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `bmc-config-${new Date().toISOString().slice(0, 10)}.json`;
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({
        title: t("settings.configTitle"),
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const chooseFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      // readAsText always yields a string, but the type does not say so, and
      // an ArrayBuffer stringified here would post "[object ArrayBuffer]" to
      // the board as a configuration.
      if (typeof reader.result === "string") setPending(reader.result);
    };
    reader.onerror = () =>
      toast({
        title: t("settings.configTitle"),
        description: t("settings.configUnreadable"),
        variant: "destructive",
      });
    reader.readAsText(file);
  };

  const doImport = () => {
    const document = pending;
    setPending(null);
    if (!document) return;
    importConfig.mutate(document, {
      onSuccess: (result) => setReport(result),
      onError: (e) =>
        toast({
          title: t("settings.configTitle"),
          description: e.message,
          variant: "destructive",
        }),
    });
  };

  return (
    <div>
      <div className="mb-6 text-lg font-bold">{t("settings.configTitle")}</div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="bw"
          isLoading={exporting}
          disabled={exporting}
          onClick={() => void doExport()}
        >
          {t("settings.configExport")}
        </Button>

        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={withSecrets}
            onCheckedChange={(v) => setWithSecrets(v === true)}
          />
          {t("settings.configWithSecrets")}
        </label>
      </div>

      {/* Next to the control that causes it, not in the documentation. */}
      {withSecrets && (
        <p className="mt-2 text-sm font-semibold text-red-700 dark:text-red-400">
          {t("settings.configSecretsWarning")}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) chooseFile(file);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="destructive"
          isLoading={importConfig.isPending}
          disabled={importConfig.isPending}
          onClick={() => fileInput.current?.click()}
        >
          {t("settings.configImport")}
        </Button>
        <span className="text-sm opacity-60">{t("settings.configNote")}</span>
      </div>

      {/* Per field: the import is not transactional, and one "done" would hide
          a hostname that took and sources that did not. */}
      {report && (
        <div className="mt-4 space-y-1 text-sm">
          {report.failed.map((line) => (
            <p
              key={line}
              className="font-semibold text-red-700 dark:text-red-400"
            >
              {t("settings.configFailed")} {line}
            </p>
          ))}
          {report.applied.map((line) => (
            <p key={line}>
              {t("settings.configApplied")} {line}
            </p>
          ))}
          {report.skipped.map((line) => (
            <p key={line} className="opacity-60">
              {t("settings.configSkipped")} {line}
            </p>
          ))}
        </div>
      )}

      <ConfirmationModal
        isOpen={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={doImport}
        title={t("settings.configImportConfirmTitle")}
        message={t("settings.configImportConfirm")}
      />
    </div>
  );
}
