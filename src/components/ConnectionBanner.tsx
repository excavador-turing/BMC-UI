import { useTranslation } from "react-i18next";

import { EXPECTED_REBOOT_SECONDS } from "@/hooks/useBoardReconnect";
import { useConnection } from "@/hooks/useConnection";

/**
 * What the page says while the board is not answering.
 *
 * It replaces nothing and hides nothing: the tab underneath keeps whatever it
 * was showing, because stale readings with a banner saying they are stale are
 * more use than an empty page. The banner goes away by the page reloading
 * itself, which is what happens the moment the daemon answers again.
 *
 * The countdown is a hint and says so once it passes. 48 seconds is measured
 * -- the upgrade guide's cost table -- not a timeout, and a board that takes
 * longer is still coming back. Presenting it as a deadline would turn a slow
 * reboot into an apparent failure.
 */
export default function ConnectionBanner() {
  const { t } = useTranslation();
  const { state, elapsed, cameBackIn } = useConnection();

  if (state === "ok") {
    if (cameBackIn === null) return null;
    // Said once, after the reload that followed a reboot. It is also how the
    // number on the upgrade guide gets checked by every person who updates.
    return (
      <div className="w-full bg-muted px-3 py-2 text-center text-sm text-foreground">
        {t("connection.cameBack", { seconds: cameBackIn })}
      </div>
    );
  }

  const overdue = state === "rebooting" && elapsed > EXPECTED_REBOOT_SECONDS;

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full bg-warning/15 px-3 py-2 text-center text-sm text-foreground"
    >
      {state === "rebooting"
        ? overdue
          ? t("connection.rebootingOverdue", { elapsed })
          : t("connection.rebooting", {
              elapsed,
              expected: EXPECTED_REBOOT_SECONDS,
            })
        : t("connection.lost", { elapsed })}
    </div>
  );
}
