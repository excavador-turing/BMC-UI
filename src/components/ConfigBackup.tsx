import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import ConfirmationModal from "@/components/ConfirmationModal";
import LoadingButton from "@/components/LoadingButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAxiosWithAuth } from "@/lib/api/_core";
import { useBackupMutation } from "@/lib/api/file";
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
  const userData = useBackupMutation();

  const backUpUserData = () => {
    userData.mutate(undefined, {
      onSuccess: ({ blob, filename }) => {
        const url = window.URL.createObjectURL(blob);
        const link = window.document.createElement("a");
        link.href = url;
        link.setAttribute("download", filename);
        window.document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        toast({
          title: t("info.backupButton"),
          description: (
            <>
              <p>{t("info.backupSuccess")}</p>
              <p className="mt-1 font-mono text-xs">{filename}</p>
            </>
          ),
        });
      },
      onError: (e) =>
        toast({
          title: t("info.backupFailed"),
          description: e.message,
          variant: "destructive",
        }),
    });
  };

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
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.configTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <LoadingButton
            type="button"
            variant="outline"
            isLoading={exporting}
            disabled={exporting}
            onClick={() => void doExport()}
          >
            {t("settings.configExport")}
          </LoadingButton>

          <Field orientation="horizontal" className="w-auto">
            <Checkbox
              id="config-with-secrets"
              checked={withSecrets}
              onCheckedChange={(v) => setWithSecrets(v)}
            />
            <FieldLabel htmlFor="config-with-secrets" className="font-normal">
              {t("settings.configWithSecrets")}
            </FieldLabel>
          </Field>
        </div>

        {/* Next to the control that causes it, not in the documentation. */}
        {withSecrets && (
          <p className="text-sm font-medium text-destructive">
            {t("settings.configSecretsWarning")}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
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
          <LoadingButton
            type="button"
            variant="destructive"
            isLoading={importConfig.isPending}
            disabled={importConfig.isPending}
            onClick={() => fileInput.current?.click()}
          >
            {t("settings.configImport")}
          </LoadingButton>
          <span className="text-sm text-muted-foreground">
            {t("settings.configNote")}
          </span>
        </div>

        {/* The other backup: the files on the BMC's user storage, not its
            configuration. It was a button under the storage bars on
            Overview, one page away from the backup it is usually confused
            with; the two are side by side now, and each says which it is. */}
        <Separator />
        <div>
          <LoadingButton
            type="button"
            variant="outline"
            isLoading={userData.isPending}
            onClick={backUpUserData}
          >
            {t("info.backupButton")}
          </LoadingButton>
        </div>

        {/* Per field: the import is not transactional, and one "done" would hide
          a hostname that took and sources that did not. */}
        {report && (
          <div className="flex flex-col gap-1 text-sm">
            {report.failed.map((line) => (
              <p key={line} className="font-medium text-destructive">
                {t("settings.configFailed")} {line}
              </p>
            ))}
            {report.applied.map((line) => (
              <p key={line}>
                {t("settings.configApplied")} {line}
              </p>
            ))}
            {report.skipped.map((line) => (
              <p key={line} className="text-muted-foreground">
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
      </CardContent>
    </Card>
  );
}
