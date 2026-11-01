import { useQueryClient } from "@tanstack/react-query";
import { type AxiosProgressEvent } from "axios";
import { filesize } from "filesize";
import React, {
  createContext,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { useToast } from "@/hooks/use-toast";
import { bmcdMessage } from "@/lib/api/bmcdMessage";
import {
  useFirmwareUpdateMutation,
  useNodeUpdateMutation,
} from "@/lib/api/file";
import {
  type FlashStatus,
  useFirmwareStatusQuery,
  useFlashStatusQuery,
} from "@/lib/api/get";

type FlashType = "firmware" | "node" | null;

export interface FlashContextValue {
  flashType: FlashType;
  setFlashType: React.Dispatch<React.SetStateAction<FlashType>>;
  isFlashing: boolean;
  statusMessage: string;
  firmwareUpdateMutation: ReturnType<typeof useFirmwareUpdateMutation>;
  nodeUpdateMutation: ReturnType<typeof useNodeUpdateMutation>;
  firmwareStatus: ReturnType<typeof useFirmwareStatusQuery>;
  flashStatus: ReturnType<typeof useFlashStatusQuery>;
  uploadProgress?: { transferred: string; total: string | null; pct: number };
  /**
   * Why the last firmware upload failed, in the daemon's words, until it is
   * cleared. The toast it also raises is gone in seconds; the dialog the
   * upload was started from keeps this on screen until someone dismisses it
   * or starts again.
   */
  firmwareError: string | null;
  clearFirmwareError: () => void;
  handleFirmwareUpload: (variables: {
    file?: File;
    url?: string;
    sha256?: string;
    park?: boolean;
  }) => Promise<void>;
  handleNodeUpdate: (variables: {
    nodeId: number;
    file?: File;
    url?: string;
    sdcard?: boolean;
    sha256?: string;
    skipCRC: boolean;
  }) => Promise<void>;
}

export const FlashContext = createContext<FlashContextValue | null>(null);

interface FlashProviderProps {
  children: ReactNode;
}

export const FlashProvider: React.FC<FlashProviderProps> = ({ children }) => {
  // The hook, not the module-level `toast`: only the hook can see which board
  // this provider belongs to, and a flash toast that does not say which board
  // it is about is the least useful of all of them.
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [flashType, setFlashType] = useState<FlashType>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [uploadProgress, setUploadProgress] =
    useState<FlashContextValue["uploadProgress"]>();
  const [firmwareError, setFirmwareError] = useState<string | null>(null);
  // Whether the upload in flight parks the image or installs it, so the
  // success message says what happened rather than what usually does.
  const [uploadPark, setUploadPark] = useState(true);
  const clearFirmwareError = useCallback(() => setFirmwareError(null), []);

  const uploadProgressCallback = useCallback(
    (progressEvent: AxiosProgressEvent) => {
      setUploadProgress({
        transferred: filesize(progressEvent.loaded ?? 0, { standard: "jedec" }),
        total: progressEvent.total
          ? filesize(progressEvent.total, { standard: "jedec" })
          : null,
        pct: progressEvent.total
          ? Math.round((progressEvent.loaded / progressEvent.total) * 100)
          : 100,
      });
    },
    []
  );

  const firmwareUpdateMutation = useFirmwareUpdateMutation(
    uploadProgressCallback
  );
  const nodeUpdateMutation = useNodeUpdateMutation(uploadProgressCallback);
  const firmwareStatus = useFirmwareStatusQuery(
    flashType === "firmware" && isFlashing
  );
  const flashStatus = useFlashStatusQuery(flashType === "node" && isFlashing);

  const handleFirmwareUpload = async (variables: {
    file?: File;
    url?: string;
    sha256?: string;
    park?: boolean;
  }) => {
    setFlashType("firmware");
    setFirmwareError(null);
    setUploadPark(variables.park === true);
    // The status of the PREVIOUS upload is still cached, errors included, and
    // would be read as this one's the moment polling restarts.
    queryClient.removeQueries({ queryKey: ["firmwareStatus"] });
    setIsUploading(true);
    setStatusMessage(t("firmwareUpgrade.uploading"));
    await firmwareUpdateMutation.mutateAsync(variables, {
      onSuccess: () => {
        setIsUploading(false);
        setIsFlashing(true);
        setStatusMessage(t("firmwareUpgrade.writing"));
        void firmwareStatus.refetch();
      },
      onError: (error) => {
        setIsUploading(false);
        const title = t("firmwareUpgrade.uploadFailed");
        const errorMessage = bmcdMessage(error);
        setFirmwareError(errorMessage);
        setStatusMessage(`${title}: ${errorMessage}`);
        toast({
          title,
          description: errorMessage,
          variant: "destructive",
        });
      },
    });
  };

  const handleNodeUpdate = async (variables: {
    nodeId: number;
    file?: File;
    url?: string;
    sdcard?: boolean;
    sha256?: string;
    skipCRC: boolean;
  }) => {
    const nodeId = variables.nodeId + 1;
    setFlashType("node");
    setIsUploading(true);
    setStatusMessage(t("flashNode.uploading", { nodeId }));
    await nodeUpdateMutation.mutateAsync(variables, {
      onSuccess: () => {
        setIsUploading(false);
        setIsFlashing(true);
        const msg = variables.skipCRC
          ? t("flashNode.flashing", { nodeId })
          : t("flashNode.flashingCrc", { nodeId });
        setStatusMessage(msg);
        void flashStatus.refetch();
      },
      onError: (error) => {
        setIsUploading(false);
        const title = t("flashNode.transferFailed", { nodeId });
        const errorMessage = bmcdMessage(error);
        setStatusMessage(`${title}: ${errorMessage}`);
        toast({
          title,
          description: errorMessage,
          variant: "destructive",
        });
      },
    });
  };

  const handleError = useCallback(
    (error: string, title: string) => {
      setIsFlashing(false);
      setUploadProgress(undefined);
      setStatusMessage(error);
      toast({
        title,
        description: error,
        variant: "destructive",
      });
    },
    [toast]
  );

  const handleTransferProgress = useCallback(
    (data: FlashStatus) => {
      const bytesWritten = data.Transferring?.bytes_written ?? 0;
      // bmcd 2.39.0 reports the size of a transfer it reads itself (from the
      // card). Where it does, show a real percentage; where it does not, the
      // bar stays full and pulsing -- "working, extent unknown" -- with only
      // the bytes written to go on.
      const size = data.Transferring?.size ?? 0;
      const known = size > 0;
      setUploadProgress({
        transferred: t("firmwareUpgrade.writtenData", {
          written: filesize(bytesWritten, { standard: "jedec" }),
        }),
        total: known ? filesize(size, { standard: "jedec" }) : null,
        pct: known
          ? Math.min(100, Math.round((bytesWritten / size) * 100))
          : 100,
      });
    },
    [t]
  );

  const handleSuccess = useCallback(
    (title: string, message: string) => {
      setIsFlashing(false);
      setUploadProgress(undefined);
      setStatusMessage(message);
      toast({ title, description: message });
    },
    [toast]
  );

  // react-hooks/set-state-in-effect: this effect *is* the external-system sync
  // the rule carves out -- bmcd's flash status arrives by polling and lands
  // here as render-time query data rather than in a subscription callback, so
  // the rule cannot tell the two apart. Silencing it beats rewriting the
  // firmware-flashing state machine into the query layer in a lint bump, on a
  // path that has never been exercised against a real board.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!isFlashing || !flashType) return;

    if (flashType === "node") {
      if (!flashStatus.isStale) {
        if (flashStatus.data?.Error) {
          handleError(flashStatus.data.Error, t("firmwareUpgrade.error"));
        } else if (flashStatus.data?.Transferring) {
          handleTransferProgress(flashStatus.data);
        } else if (flashStatus.data?.Done) {
          handleSuccess(t("flashNode.success"), t("flashNode.successMessage"));
        }
      }
    } else if (flashType === "firmware") {
      if (!firmwareStatus.isStale) {
        if (firmwareStatus.data?.Error) {
          setFirmwareError(firmwareStatus.data.Error);
          handleError(firmwareStatus.data.Error, t("firmwareUpgrade.error"));
        } else if (firmwareStatus.data?.Transferring) {
          handleTransferProgress(firmwareStatus.data);
        } else if (firmwareStatus.data?.Done) {
          // A parked image stops on the card (SQU-134): nothing is staged, so
          // no reboot is offered. It is now a candidate in the version list
          // like any other, and installing it is a separate, deliberate
          // choice made there. A board with no card installs directly
          // instead, which DOES stage: the slots panel then offers the
          // reboot, with the wording for this board revision.
          if (uploadPark) {
            handleSuccess(
              t("firmwareUpgrade.success"),
              t("firmwareUpgrade.successMessage")
            );
          } else {
            handleSuccess(
              t("firmwareUpgrade.successStaged"),
              t("firmwareUpgrade.successStagedMessage")
            );
          }
          // The parked image is a new candidate under the SD-card source, and
          // an installed one is now staged; without these the page stays as
          // it was until the next check.
          void queryClient.invalidateQueries({
            queryKey: ["firmwareAvailable"],
          });
          void queryClient.invalidateQueries({ queryKey: ["firmwareSlots"] });
        }
      }
    }
  }, [
    isFlashing,
    flashType,
    flashStatus.data,
    firmwareStatus.data,
    firmwareStatus.isStale,
    flashStatus.isStale,
    handleError,
    handleTransferProgress,
    handleSuccess,
    queryClient,
    uploadPark,
    t,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <FlashContext.Provider
      value={{
        flashType,
        setFlashType,
        isFlashing: isUploading || isFlashing,
        statusMessage,
        firmwareUpdateMutation,
        nodeUpdateMutation,
        firmwareStatus,
        flashStatus,
        uploadProgress,
        firmwareError,
        clearFirmwareError,
        handleFirmwareUpload,
        handleNodeUpdate,
      }}
    >
      <>{children}</>
    </FlashContext.Provider>
  );
};
