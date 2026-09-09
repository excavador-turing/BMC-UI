import { TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAboutTabData } from "@/lib/api/get";

/**
 * What flashing actually targets on a v2.5 board.
 *
 * The page presents a node picker and an Install button. On v2.5 the daemon
 * underneath **ignores the picker** when more than one module is in maskrom:
 * it writes to whichever enumerates first and reports success (SQU-105). The
 * board this fork is developed on is a v2.5.2.
 *
 * This is the one operation on the whole backlog that destroys data, so the
 * warning is red and stays until SQU-105 makes the target real. It is shown
 * only where it is true — a v2.6 board is not warned about a v2.5 defect,
 * because a warning that is always on is one nobody reads.
 */
function Content() {
  const { t } = useTranslation();
  const { data } = useAboutTabData();

  // `v2.5`, `v2.5.2`, and anything else in that family. A board whose
  // revision cannot be read is not warned: an unreadable field is not
  // evidence of a v2.5, and guessing would put a red box on every board.
  if (!data.board_revision?.startsWith("v2.5")) return null;

  return (
    <div className="flex items-start gap-3 rounded-md border border-red-600 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
      <TriangleAlert className="mt-0.5 size-5 shrink-0" />
      <div className="text-sm">
        <p className="font-semibold">{t("flashNode.maskromWarningTitle")}</p>
        <p className="mt-1">
          {t("flashNode.maskromWarning", { revision: data.board_revision })}
        </p>
      </div>
    </div>
  );
}

export default function MaskromWarning() {
  // A warning that disappears because its own query failed is worse than no
  // warning: it fails *open*, on the one page where the cost of being wrong
  // is a module that no longer boots. The boundary keeps a general caution in
  // place when the specific one cannot be determined.
  return (
    <ErrorBoundary label="MaskromWarning" fallback={<Fallback />}>
      <Content />
    </ErrorBoundary>
  );
}

function Fallback() {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-3 rounded-md border border-red-600 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
      <TriangleAlert className="mt-0.5 size-5 shrink-0" />
      <div className="text-sm">
        <p className="font-semibold">{t("flashNode.maskromWarningTitle")}</p>
        <p className="mt-1">{t("flashNode.maskromWarningUnknown")}</p>
      </div>
    </div>
  );
}
