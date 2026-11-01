import { AlertTriangle } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import ConfirmationModal from "@/components/ConfirmationModal";
import LoadingButton from "@/components/LoadingButton";
import TextField from "@/components/TextField";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import UsageBar from "@/components/UsageBar";
import { useFlash } from "@/hooks/use-flash";
import { useRebootCopy } from "@/hooks/useRebootCopy";
import { isNoCardRefusal } from "@/lib/api/firmwarePage";
import { useSdCardPresenceQuery } from "@/lib/api/get";

/**
 * Upload a `.tpu`, in a dialog opened from the Available firmware card.
 *
 * It was an always-open card at the foot of the page. Uploading is rare --
 * most installs come from a source -- and the result of one is a new row in
 * the list the dialog is opened from, which is where the reader already is.
 *
 * Two things can happen to the image, and which is decided by the board:
 *
 * - With an SD card it is PARKED: written to the card and nothing else. It
 *   then appears in the list, and installing it is a separate, visible choice.
 * - Without one there is nowhere to park it, and the daemon refuses
 *   ("/mnt/sdcard is not mounted..."). The dialog then says so up front and
 *   installs directly: written to the spare slot and staged for the next boot,
 *   with the same reboot warning every other install ends in.
 *
 * The daemon has no field that says "a card is mounted" (see `sdCardPresent`),
 * so the card test is a hint. When it is wrong, or could not be made, the
 * refusal comes back as an error that stays in the dialog with an "Install
 * directly instead" beside it.
 *
 * The dialog does not close while the image is uploading or being written:
 * the progress lives here, and closing it would hide the only sign that the
 * board is busy.
 */
export default function FirmwareUploadDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);
  const [confirmFlashModal, setConfirmFlashModal] = useState(false);
  // Set by "Install directly instead": the card test said there was one and
  // the daemon says there is not.
  const [forceDirect, setForceDirect] = useState(false);
  const {
    flashType,
    isFlashing,
    statusMessage,
    firmwareUpdateMutation,
    uploadProgress,
    firmwareError,
    clearFirmwareError,
    handleFirmwareUpload,
  } = useFlash();
  const copy = useRebootCopy();
  const card = useSdCardPresenceQuery(open);

  const busy = firmwareUpdateMutation.isPending || isFlashing;
  // Park unless the board says it has no card. Not knowing is not "no": the
  // old behaviour stands, and the refusal, if it comes, offers the way out.
  const park = !forceDirect && card.data !== false;
  const noCardRefusal = isNoCardRefusal(firmwareError);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmFlashModal(true);
  };

  const handleUpload = () => {
    if (formRef.current) {
      setConfirmFlashModal(false);

      const form = formRef.current;
      const file = (form.elements.namedItem("file") as HTMLInputElement)
        .files?.[0];
      // The same trap as the node form had: `file-url` has not been a field
      // here for several releases, and `.value` on the null it returns threw
      // before anything was uploaded. This form takes a local file only, so
      // there is no URL to read.
      const url = undefined;
      const sha256 = (form.elements.namedItem("sha256") as HTMLInputElement)
        .value;

      // Parked, not installed, where there is a card. The upload used to BE
      // the install, which made this form a second way to install that
      // bypassed the list -- someone could upload one image and install
      // another with the page never showing which. Now it lands on the SD
      // card and appears in the list like every other candidate. With no card
      // the daemon refuses to park, so the image is installed directly.
      void handleFirmwareUpload({ file, url, sha256, park });
    }
  };

  const close = (next: boolean) => {
    if (!next) {
      if (busy) return;
      // Closing is dismissing: the error was about an attempt nobody is
      // looking at any more.
      clearFirmwareError();
      setForceDirect(false);
    }
    onOpenChange(next);
  };

  const installDirectlyInstead = () => {
    clearFirmwareError();
    setForceDirect(true);
    setConfirmFlashModal(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="sm:max-w-md" showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>
              {park
                ? t("firmwareUpgrade.parkButton")
                : t("firmwareUpgrade.directButton")}
            </DialogTitle>
            <DialogDescription>
              {park
                ? t("firmwareUpgrade.parkModalDescription")
                : card.data === false
                  ? t("firmwareUpgrade.directNoCard")
                  : t("firmwareUpgrade.directModalDescription")}
            </DialogDescription>
          </DialogHeader>
          <form ref={formRef} onSubmit={handleSubmit}>
            <FieldGroup>
              <TextField
                type="file"
                name="file"
                label={t("firmwareUpgrade.fileInput")}
                accept=".tpu,.tpu.xz,application/octet-stream"
              />
              <TextField
                type="text"
                name="sha256"
                label={t("firmwareUpgrade.shaInput")}
              />
              <div>
                <LoadingButton
                  type="submit"
                  disabled={busy || card.isPending}
                  isLoading={
                    firmwareUpdateMutation.isPending ||
                    (isFlashing && flashType === "firmware")
                  }
                >
                  {park
                    ? t("firmwareUpgrade.parkButton")
                    : t("firmwareUpgrade.directButton")}
                </LoadingButton>
              </div>
              {uploadProgress && flashType === "firmware" && (
                <UsageBar
                  aria-label={t("firmwareUpgrade.ariaProgress")}
                  value={uploadProgress.pct}
                  label={`${uploadProgress.transferred}${
                    uploadProgress.total ? ` / ${uploadProgress.total}` : ""
                  }`}
                  pulsing={busy}
                />
              )}
              {/* A failure stays until it is dismissed, closed or retried: it
                used to be a toast, gone in seconds, and the only trace of why
                the upload did nothing. */}
              {firmwareError && (
                <Alert variant="destructive">
                  <AlertTriangle />
                  <AlertTitle>{t("firmwareUpgrade.uploadFailed")}</AlertTitle>
                  <AlertDescription className="flex flex-col items-start gap-2">
                    <p>{firmwareError}</p>
                    {noCardRefusal && park && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={installDirectlyInstead}
                      >
                        {t("firmwareUpgrade.installDirectly")}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearFirmwareError}
                    >
                      {t("firmwareUpgrade.dismiss")}
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              {flashType === "firmware" && statusMessage && !firmwareError && (
                <div className="text-sm">{statusMessage}</div>
              )}
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmationModal
        isOpen={confirmFlashModal}
        onClose={() => setConfirmFlashModal(false)}
        onConfirm={handleUpload}
        title={
          park
            ? t("firmwareUpgrade.parkModalTitle")
            : t("firmwareUpgrade.directModalTitle")
        }
        message={
          park ? (
            t("firmwareUpgrade.parkModalDescription")
          ) : (
            <div className="flex flex-col gap-2">
              <p>{t("firmwareUpgrade.directModalDescription")}</p>
              {/* What the reboot that starts it does to the nodes, for this
                board revision: the same sentence the slots panel's Reboot
                button asks with. */}
              <p>{copy.upgrade}</p>
            </div>
          )
        }
      />
    </>
  );
}
