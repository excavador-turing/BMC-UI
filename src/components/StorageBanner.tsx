import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import ConfirmationModal from "@/components/ConfirmationModal";
import LoadingButton from "@/components/LoadingButton";
import { useToast } from "@/hooks/use-toast";
import { useConnection } from "@/hooks/useConnection";
import { bmcdMessage } from "@/lib/api/bmcdMessage";
import { useStorageQuery } from "@/lib/api/get";
import { useRepairStorageMutation } from "@/lib/api/set";
import {
  bannerKind,
  KNOWN_FAULTS_URL,
  repairBlocker,
  showRepair,
} from "@/lib/api/storageView";

/**
 * Said on every page when the board's settings will not survive a reboot.
 *
 * A board whose settings volume would not mount runs on factory defaults, and
 * that is easy to miss: everything works, the password even changes, and the
 * next power cut puts it all back. So this sits above the page like the
 * connection banner, and not on a settings tab you might never open. It is
 * mounted by the layout and by the factory-password page, which stands in for
 * the layout, so it is seen before the password is changed rather than after.
 *
 * Nothing is shown unless the board said `temporary`: a daemon without the
 * endpoint, an answer this interface cannot read, and a healthy board all
 * render nothing. The question is asked once per page load and never polled.
 *
 * The repair removes the damaged volume and reboots. It asks first, and says
 * what it costs: the board comes back on factory settings (which it is
 * running on anyway) and, on a v2.4 board, the BMC reboot power-cycles the
 * nodes.
 */
export default function StorageBanner() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { expectReboot } = useConnection();
  const storage = useStorageQuery();
  const { mutate: repair, isPending } = useRepairStorageMutation();
  const [confirming, setConfirming] = useState(false);
  const [rebooting, setRebooting] = useState(false);

  const view = storage.data;
  const kind = bannerKind(view);
  if (!view || !kind) return null;

  const blocker = repairBlocker(view);

  const handleRepair = () => {
    setConfirming(false);
    repair(undefined, {
      onSuccess: () => {
        // The same wait a reboot from Settings starts: the connection banner
        // counts, polls the board, and reloads the page when it answers.
        setRebooting(true);
        expectReboot();
        toast({
          title: t("storage.repairButton"),
          description: t("storage.repairStarted"),
        });
      },
      onError: (e) =>
        toast({
          title: t("storage.repairFailed"),
          description: bmcdMessage(e),
          variant: "destructive",
        }),
    });
  };

  return (
    <div
      role="alert"
      data-testid="storage-banner"
      className="w-full border-b border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-foreground"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-start gap-x-3 gap-y-2">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="font-medium">
            {kind === "keyhold" ? t("storage.keyhold") : t("storage.unmounted")}
          </p>
          {kind === "unmounted" && (
            <>
              {view.detail && (
                <details>
                  <summary className="w-fit cursor-pointer underline underline-offset-3">
                    {t("storage.details")}
                  </summary>
                  <pre className="mt-2 max-w-full overflow-x-auto rounded-md bg-background/60 p-2 font-mono text-xs break-words whitespace-pre-wrap">
                    {view.detail}
                  </pre>
                </details>
              )}
              <a
                className="w-fit underline underline-offset-3"
                href={KNOWN_FAULTS_URL}
                target="_blank"
                rel="noreferrer noopener"
              >
                {t("storage.knownFaults")}
              </a>
              {blocker && <p data-testid="storage-repair-blocker">{blocker}</p>}
            </>
          )}
        </div>
        {showRepair(view) && (
          <LoadingButton
            type="button"
            variant="destructive"
            size="sm"
            isLoading={isPending || rebooting}
            onClick={() => setConfirming(true)}
          >
            {rebooting ? t("storage.rebooting") : t("storage.repairButton")}
          </LoadingButton>
        )}
      </div>
      <ConfirmationModal
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={handleRepair}
        title={t("storage.repairTitle")}
        message={
          <>
            <p>{t("storage.repairRemoves")}</p>
            <p>{t("storage.repairFactory")}</p>
            <p>{t("storage.repairNodes")}</p>
          </>
        }
      />
    </div>
  );
}
