import { useTranslation } from "react-i18next";

import { useRebootNodesQuery } from "@/lib/api/get";

/**
 * The words about the nodes in every dialog that reboots the BMC, chosen by
 * the board's revision.
 *
 * A v2.4 has no latch on the node power rails, so any BMC reboot power-cycles
 * all four nodes; a v2.5 has latches and its nodes keep running. Until the
 * revision is known -- or when it is one this interface does not know -- the
 * copy says both, which is never wrong for anybody.
 */
export function useRebootCopy() {
  const { t } = useTranslation();
  const { data } = useRebootNodesQuery();
  const nodes = data ?? "unknown";

  return {
    nodes,
    /** The Settings reboot dialog, and the banner's. */
    modal:
      nodes === "keep_running"
        ? t("rebootNodes.modalKeep")
        : nodes === "power_cycled"
          ? t("rebootNodes.modal24")
          : t("rebootNodes.modalUnknown"),
    /** The line under the Reboot button. */
    note:
      nodes === "keep_running"
        ? t("rebootNodes.noteKeep")
        : nodes === "power_cycled"
          ? t("rebootNodes.note24")
          : t("rebootNodes.noteUnknown"),
    /** The dialog that reboots to start a staged firmware. */
    upgrade:
      nodes === "keep_running"
        ? t("rebootNodes.upgradeKeep")
        : nodes === "power_cycled"
          ? t("rebootNodes.upgrade24")
          : t("rebootNodes.upgradeUnknown"),
    /** The repair dialog's warning: nothing to say on a v2.5. */
    repair:
      nodes === "keep_running"
        ? null
        : nodes === "power_cycled"
          ? t("storage.repairNodes")
          : t("storage.repairNodesUnknown"),
  };
}
