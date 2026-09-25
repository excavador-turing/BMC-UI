import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import ConfirmationModal from "@/components/ConfirmationModal";
import LoadingButton from "@/components/LoadingButton";
import TextField from "@/components/TextField";
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

/**
 * Upload a `.tpu` to the SD card, in a dialog opened from the Available
 * firmware card.
 *
 * It was an always-open card at the foot of the page. Uploading is rare --
 * most installs come from a source -- and the result of one is a new row in
 * the list the dialog is opened from, which is where the reader already is.
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
  const {
    flashType,
    isFlashing,
    statusMessage,
    firmwareUpdateMutation,
    uploadProgress,
    handleFirmwareUpload,
  } = useFlash();

  const busy = firmwareUpdateMutation.isPending || isFlashing;

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

      // Parked, not installed. The upload used to BE the install, which made
      // this form a second way to install that bypassed the list -- someone
      // could upload one image and install another with the page never
      // showing which. Now it lands on the SD card and appears in the list
      // like every other candidate.
      void handleFirmwareUpload({ file, url, sha256, park: true });
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && busy) return;
          onOpenChange(next);
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>{t("firmwareUpgrade.parkButton")}</DialogTitle>
            <DialogDescription>
              {t("firmwareUpgrade.parkModalDescription")}
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
                  disabled={busy}
                  isLoading={
                    firmwareUpdateMutation.isPending ||
                    (isFlashing && flashType === "firmware")
                  }
                >
                  {t("firmwareUpgrade.parkButton")}
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
              {flashType === "firmware" && statusMessage && (
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
        title={t("firmwareUpgrade.parkModalTitle")}
        message={t("firmwareUpgrade.parkModalDescription")}
      />
    </>
  );
}
