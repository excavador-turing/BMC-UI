import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | React.ReactNode;
}

/**
 * "Are you sure", before something consequential.
 *
 * An alert dialog rather than a dialog: it does not close on a click outside
 * it, so a stray tap cannot be taken for either answer. It is the same on a
 * phone -- the footer stacks its buttons -- so there is no second, drawer
 * form of it to keep in step.
 */
export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
}: ConfirmationModalProps) {
  const { t } = useTranslation();

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {/* A message with its own paragraphs cannot sit inside the <p> a
              description renders by default. */}
          <AlertDialogDescription
            render={typeof message === "string" ? undefined : <div />}
          >
            {message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("ui.cancel")}</AlertDialogCancel>
          {/* Red at the point of commitment, like the reboot modal's. Every
              caller of this modal is confirming something consequential --
              flashing a module, resetting the network, restoring a config,
              renaming the board -- which is why they ask at all. */}
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {t("ui.continue")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
