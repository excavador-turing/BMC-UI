import { useTranslation } from "react-i18next";

import LoadingButton from "@/components/LoadingButton";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RebootModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReboot: () => void;
  title: string;
  message: string | React.ReactNode;
  isPending?: boolean;
}

/** The confirmation in front of a reboot: `ConfirmationModal`, with a spinner. */
export default function RebootModal({
  isOpen,
  onClose,
  onReboot,
  title,
  message,
  isPending = false,
}: RebootModalProps) {
  const { t } = useTranslation();

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription
            render={typeof message === "string" ? undefined : <div />}
          >
            {message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("ui.cancel")}</AlertDialogCancel>
          <LoadingButton
            type="button"
            variant="destructive"
            onClick={onReboot}
            isLoading={isPending}
          >
            {t("ui.reboot")}
          </LoadingButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
