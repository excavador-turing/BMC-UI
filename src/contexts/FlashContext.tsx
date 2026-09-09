import { type AxiosError, type AxiosProgressEvent } from "axios";
import { filesize } from "filesize";
import React, {
  createContext,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { toast } from "@/hooks/use-toast";
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
    sha256?: string;
    skipCRC: boolean;
  }) => Promise<void>;
}

export const FlashContext = createContext<FlashContextValue | null>(null);

interface FlashProviderProps {
  children: ReactNode;
}

export const FlashProvider: React.FC<FlashProviderProps> = ({ children }) => {
  const { t } = useTranslation();
  const [flashType, setFlashType] = useState<FlashType>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [uploadProgress, setUploadProgress] =
    useState<FlashContextValue["uploadProgress"]>();

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
        const errorMessage =
          ((error as AxiosError).response?.data as string) ?? error.message;
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
        const errorMessage =
          ((error as AxiosError).response?.data as string) ?? error.message;
        setStatusMessage(`${title}: ${errorMessage}`);
        toast({
          title,
          description: errorMessage,
          variant: "destructive",
        });
      },
    });
  };

  const handleError = useCallback((error: string, title: string) => {
    setIsFlashing(false);
    setUploadProgress(undefined);
    setStatusMessage(error);
    toast({
      title,
      description: error,
      variant: "destructive",
    });
  }, []);

  const handleTransferProgress = useCallback(
    (data: FlashStatus) => {
      const bytesWritten = data.Transferring?.bytes_written ?? 0;
      setUploadProgress({
        transferred: t("firmwareUpgrade.writtenData", {
          written: filesize(bytesWritten, { standard: "jedec" }),
        }),
        total: null,
        pct: 100,
      });
    },
    [t]
  );

  const handleSuccess = useCallback((title: string, message: string) => {
    setIsFlashing(false);
    setUploadProgress(undefined);
    setStatusMessage(message);
    toast({ title, description: message });
  }, []);

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
          handleError(firmwareStatus.data.Error, t("firmwareUpgrade.error"));
        } else if (firmwareStatus.data?.Transferring) {
          handleTransferProgress(firmwareStatus.data);
        } else if (firmwareStatus.data?.Done) {
          // No reboot offered, because an upload from the browser parks the
          // image on the SD card and stops (SQU-134): nothing is staged, so a
          // reboot here would do nothing at all. The image is now a candidate
          // in the version list like any other, and installing it is a
          // separate, deliberate choice made there.
          handleSuccess(
            t("firmwareUpgrade.success"),
            t("firmwareUpgrade.successMessage")
          );
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
        handleFirmwareUpload,
        handleNodeUpdate,
      }}
    >
      <>{children}</>
    </FlashContext.Provider>
  );
};
