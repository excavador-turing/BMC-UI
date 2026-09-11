import { createLazyFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import ConfirmationModal from "@/components/ConfirmationModal";
import FirmwareCandidates from "@/components/FirmwareCandidates";
import FirmwareSlots from "@/components/FirmwareSlots";
import FirmwareSources from "@/components/FirmwareSources";
import TabView from "@/components/TabView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useFlash } from "@/hooks/use-flash";

export const Route = createLazyFileRoute("/_tabLayout/firmware-upgrade")({
  component: FirmwareUpgrade,
});

export function FirmwareUpgrade() {
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
      // this form a second way to install that bypassed the list above --
      // someone could upload one image and install another with the page
      // never showing which. Now it lands on the SD card and appears in the
      // list like every other candidate.
      void handleFirmwareUpload({ file, url, sha256, park: true });
    }
  };

  return (
    <TabView title={t("firmwareUpgrade.header")}>
      <FirmwareSlots />
      <FirmwareCandidates />
      <FirmwareSources />

      <form ref={formRef} onSubmit={handleSubmit}>
        <div className="mb-4">
          <Input
            type="file"
            name="file"
            label={t("firmwareUpgrade.fileInput")}
            accept=".tpu,.tpu.xz,application/octet-stream"
          />
        </div>
        <div className="mb-4">
          <Input
            type="text"
            name="sha256"
            label={t("firmwareUpgrade.shaInput")}
          />
        </div>
        <div>
          <Button
            type="submit"
            disabled={firmwareUpdateMutation.isPending || isFlashing}
            isLoading={
              firmwareUpdateMutation.isPending ||
              (isFlashing && flashType === "firmware")
            }
          >
            {t("firmwareUpgrade.parkButton")}
          </Button>
        </div>
        {uploadProgress && flashType === "firmware" && (
          <Progress
            aria-label={t("firmwareUpgrade.ariaProgress")}
            className="mt-4"
            value={uploadProgress.pct}
            label={`${uploadProgress.transferred}${
              uploadProgress.total ? ` / ${uploadProgress.total}` : ""
            }`}
            pulsing={firmwareUpdateMutation.isPending || isFlashing}
          />
        )}
        {flashType === "firmware" && statusMessage && (
          <div className="mt-4 text-sm">{statusMessage}</div>
        )}
      </form>
      <ConfirmationModal
        isOpen={confirmFlashModal}
        onClose={() => setConfirmFlashModal(false)}
        onConfirm={handleUpload}
        title={t("firmwareUpgrade.parkModalTitle")}
        message={t("firmwareUpgrade.parkModalDescription")}
      />
    </TabView>
  );
}
