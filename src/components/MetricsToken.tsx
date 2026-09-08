import { Check, Copy, Eye, EyeOff, KeyRound, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import TableItem from "@/components/TableItem";
import { Button } from "@/components/ui/button";
import { type MetricsTokenResponse, useMetricsTokenQuery } from "@/lib/api/get";
import { useRotateMetricsTokenMutation } from "@/lib/api/set";

/**
 * The credential a metrics scraper uses, and nothing else.
 *
 * This is deliberately not the root password. bmcd authenticates `/api/bmc`
 * against `/etc/shadow` with no per-route authorization behind it, so any
 * account it accepts can also power a node off and flash firmware -- which is
 * not what belongs in a Prometheus config. `/metrics` takes this token
 * instead, and the token is useless against `/api/bmc`.
 *
 * NOTHING IS FETCHED ON MOUNT. Reading the token creates one on a board that
 * has never had it, and opening a page should not mint a credential nobody
 * asked for. The operator asks, explicitly, with the button.
 */
export default function MetricsToken() {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmingRotate, setConfirmingRotate] = useState(false);
  const [rotated, setRotated] = useState<MetricsTokenResponse | null>(null);

  const query = useMetricsTokenQuery();
  const rotate = useRotateMetricsTokenMutation();

  // The rotation result wins: it is newer than anything the query holds.
  const token = rotated ?? query.data ?? null;
  const busy = query.isFetching || rotate.isPending;

  const copy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is denied over plain HTTP and in some browsers.
      // The token is on screen when revealed, so this is not worth an error.
      setCopied(false);
    }
  };

  const doRotate = async () => {
    setConfirmingRotate(false);
    const next = await rotate.mutateAsync();
    setRotated(next);
    setRevealed(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <KeyRound className="size-5" />
        {t("info.metricsTokenTitle")}
      </h2>
      <p className="text-sm opacity-70">{t("info.metricsTokenDescription")}</p>

      {!token && (
        <div>
          <Button
            variant="bw"
            disabled={busy}
            onClick={() => void query.refetch()}
          >
            {t("info.metricsTokenShow")}
          </Button>
          {query.isError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {t("info.metricsTokenError")}
            </p>
          )}
        </div>
      )}

      {token && (
        <dl className="flex flex-col">
          <TableItem term={t("info.metricsTokenUsername")}>
            <span className="font-mono">{token.username}</span>
          </TableItem>
          <TableItem term={t("info.metricsTokenValue")}>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm break-all">
                {revealed ? token.token : "•".repeat(24)}
              </span>
              <Button
                variant="bwSquare"
                size="icon"
                aria-label={t("info.metricsTokenReveal")}
                onClick={() => setRevealed((v) => !v)}
              >
                {revealed ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </Button>
              <Button
                variant="bwSquare"
                size="icon"
                aria-label={t("info.metricsTokenCopy")}
                onClick={() => void copy()}
              >
                {copied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
          </TableItem>
          <TableItem term={t("info.metricsTokenCreated")}>
            {token.created_at}
          </TableItem>
        </dl>
      )}

      {token && !confirmingRotate && (
        <div>
          <Button
            variant="bw"
            disabled={busy}
            onClick={() => setConfirmingRotate(true)}
          >
            <RefreshCw className="mr-2 size-4" />
            {t("info.metricsTokenRotate")}
          </Button>
        </div>
      )}

      {confirmingRotate && (
        <div className="flex flex-col gap-2 rounded-md border border-amber-500 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <p className="text-sm font-semibold">
            {t("info.metricsTokenRotateConfirmTitle")}
          </p>
          <p className="text-sm">{t("info.metricsTokenRotateConfirmBody")}</p>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => void doRotate()}
            >
              {t("info.metricsTokenRotate")}
            </Button>
            <Button variant="bw" onClick={() => setConfirmingRotate(false)}>
              {t("ui.cancel")}
            </Button>
          </div>
        </div>
      )}

      {rotated && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          {t("info.metricsTokenRotated")}
        </p>
      )}
    </div>
  );
}
