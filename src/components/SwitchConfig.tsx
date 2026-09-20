import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import ConfirmationModal from "@/components/ConfirmationModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  type SwitchDocument,
  useSwitchPresetsQuery,
  useSwitchQuery,
} from "@/lib/api/get";
import {
  useApplySwitchMutation,
  useConfirmSwitchMutation,
  useRevertSwitchMutation,
} from "@/lib/api/set";

/** The ports, in the order they sit on the board. */
const PORT_ORDER = ["node1", "node2", "node3", "node4", "bmc", "ge0", "ge1"];

/**
 * A colour per VLAN, so the table can be read without matching numbers.
 *
 * Assigned by order of appearance rather than by VLAN id, because the ids are
 * the operator's and may be anything -- and under Split they are internal
 * numbers nobody should be reading at all.
 */
const VLAN_COLOURS = [
  "bg-sky-100 dark:bg-sky-900",
  "bg-emerald-100 dark:bg-emerald-900",
  "bg-amber-100 dark:bg-amber-900",
  "bg-violet-100 dark:bg-violet-900",
];

function colourFor(vlans: number[], vid: number | null): string {
  if (vid === null) return "";
  const index = vlans.indexOf(vid);
  return index < 0 ? "" : VLAN_COLOURS[index % VLAN_COLOURS.length];
}

/** Every VLAN in the document, in the order the ports mention them. */
function vlansOf(document: SwitchDocument): number[] {
  const seen: number[] = [];
  for (const name of PORT_ORDER) {
    const port = document.ports[name];
    if (!port) continue;
    for (const vid of [port.untagged, ...port.tagged]) {
      if (vid !== null && vid !== undefined && !seen.includes(vid)) {
        seen.push(vid);
      }
    }
  }
  return seen;
}

/**
 * The document as a table, one row per port.
 *
 * The seven ports as they are on the board: four modules, the BMC's own port,
 * and the two uplink jacks. The BMC's row is the one that matters and is
 * marked, because it is the only port whose configuration can take the board
 * off the network.
 */
function PortTable({ document }: { document: SwitchDocument }) {
  const { t } = useTranslation();
  const vlans = vlansOf(document);

  if (!document.vlan_filtering) {
    return (
      <div className="text-sm opacity-80">{t("switchConfig.oneNetwork")}</div>
    );
  }

  return (
    <table className="w-full max-w-lg text-sm">
      <thead>
        <tr className="text-left opacity-60">
          <th className="py-1 font-normal">{t("switchConfig.port")}</th>
          <th className="py-1 font-normal">{t("switchConfig.untagged")}</th>
          <th className="py-1 font-normal">{t("switchConfig.tagged")}</th>
        </tr>
      </thead>
      <tbody>
        {PORT_ORDER.map((name) => {
          const port = document.ports[name];
          if (!port) return null;
          return (
            <tr key={name} className={colourFor(vlans, port.untagged)}>
              <td className="py-1 font-mono">
                {name}
                {name === "bmc" && (
                  <span className="ml-2 text-xs opacity-60">
                    {t("switchConfig.thisBoard")}
                  </span>
                )}
              </td>
              <td className="py-1 font-mono">{port.untagged ?? "—"}</td>
              <td className="py-1 font-mono">
                {port.tagged.length > 0 ? port.tagged.join(", ") : "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * The on-board switch: which ports can talk to which.
 *
 * The most-asked feature on the public roadmap, and the one with the sharpest
 * failure. A wrong VLAN on the BMC's own port takes the board off the
 * network, and the thing you would use to undo it is this page.
 *
 * So the card never applies anything it keeps. An apply puts the change on
 * the switch and starts a window; confirming is a second request, and the
 * fact that it arrives at all is the proof that the new configuration works.
 * If this page cannot reach the board there is nothing to press, and the
 * board puts the old configuration back by itself. That is the design
 * working, not a failure.
 *
 * WHAT THE CARD NEVER DOES IS EXPAND A PRESET ITSELF. The board returns each
 * preset's full table; a client that computed its own would eventually
 * disagree with the board about what a preset means, and the way that
 * disagreement surfaces is a board nobody can reach.
 */
export default function SwitchConfig() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const state = useSwitchQuery();
  const presets = useSwitchPresetsQuery();
  const apply = useApplySwitchMutation();
  const confirm = useConfirmSwitchMutation();
  const revert = useRevertSwitchMutation();

  const [chosen, setChosen] = useState<string>("flat");
  const [mgmtVid, setMgmtVid] = useState("10");
  const [nodeVid, setNodeVid] = useState("20");
  const [redundant, setRedundant] = useState(true);
  const [showTable, setShowTable] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // A countdown has to count. One timer for the card, and only while
  // something is actually pending.
  const pending = state.data?.pending ?? null;
  useEffect(() => {
    if (!pending?.counting_from) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [pending?.counting_from]);

  // A board on an older daemon has no such endpoint. A card that cannot work
  // is not shown as a card that is broken.
  if (state.isError || !state.data || presets.isError || !presets.data) {
    return null;
  }

  const limits = presets.data.limits;
  const preview =
    presets.data.presets.find((preset) => preset.name === chosen)?.document ??
    null;
  const summary = presets.data.presets.find(
    (preset) => preset.name === chosen
  )?.summary;

  const body = () => {
    if (chosen !== "trunk") return { preset: chosen };
    return {
      preset: "trunk",
      management_vid: Number(mgmtVid),
      node_vid: Number(nodeVid),
      second_uplink: redundant ? "redundant" : "off",
    };
  };

  const trunkNumbersLook =
    chosen !== "trunk" ||
    (Number(mgmtVid) >= limits.vid_min &&
      Number(mgmtVid) <= limits.vid_max &&
      Number(nodeVid) >= limits.vid_min &&
      Number(nodeVid) <= limits.vid_max &&
      Number(mgmtVid) !== Number(nodeVid));

  const applyNow = () => {
    apply.mutate(body(), {
      onSuccess: () =>
        toast({
          title: t("switchConfig.applied"),
          description: t("switchConfig.appliedNote"),
        }),
      onError: (e: Error) =>
        toast({
          title: t("switchConfig.applyFailed"),
          description: e.message,
          variant: "destructive",
        }),
    });
  };

  const remaining = (() => {
    if (!pending?.counting_from) return null;
    const deadline =
      new Date(pending.counting_from).getTime() + pending.window_s * 1000;
    return Math.max(0, Math.round((deadline - now) / 1000));
  })();

  return (
    <div>
      <div className="mb-6 text-lg font-bold">{t("switchConfig.title")}</div>

      {/* What the board is doing now, before anything about changing it. */}
      <div className="mb-6">
        <div className="mb-2 font-semibold">{t("switchConfig.running")}</div>
        <PortTable document={state.data.running} />
        {state.data.confirmed === null && (
          <div className="mt-2 text-sm opacity-80">
            {t("switchConfig.nothingConfirmed")}
          </div>
        )}
      </div>

      {/* A change that has been applied and not yet kept. This is the only
          part of the card that is urgent, so it comes before the controls. */}
      {pending && (
        <div className="mb-6 rounded-md border border-amber-500 p-3 text-sm">
          <div className="font-semibold text-amber-700 dark:text-amber-500">
            {t("switchConfig.pendingTitle")}
          </div>
          <div className="mt-1">
            {remaining === null
              ? t("switchConfig.waitingForUplink")
              : t("switchConfig.countdown", { seconds: remaining })}
          </div>
          <div className="mt-3 flex gap-4">
            <Button
              type="button"
              disabled={confirm.isPending}
              onClick={() =>
                confirm.mutate(pending.token, {
                  onSuccess: () =>
                    toast({ title: t("switchConfig.confirmed") }),
                  onError: (e: Error) =>
                    toast({
                      title: t("switchConfig.confirmFailed"),
                      description: e.message,
                      variant: "destructive",
                    }),
                })
              }
            >
              {t("switchConfig.confirm")}
            </Button>
            <Button
              type="button"
              variant="bw"
              disabled={revert.isPending}
              onClick={() => revert.mutate()}
            >
              {t("switchConfig.revertNow")}
            </Button>
          </div>
        </div>
      )}

      {/* Said once, after a revert, because the page that would have shown the
          countdown is usually the page that went away. */}
      {!pending && state.data.last_revert?.reason === "not_confirmed" && (
        <div className="mb-6 text-sm text-amber-700 dark:text-amber-500">
          {t("switchConfig.wasReverted", {
            at: new Date(state.data.last_revert.at).toLocaleTimeString(),
          })}
        </div>
      )}

      <div className="flex max-w-2xl flex-col gap-3">
        <div className="font-semibold">{t("switchConfig.change")}</div>

        <div className="flex flex-wrap gap-2">
          {presets.data.presets.map((preset) => (
            <Button
              key={preset.name}
              type="button"
              variant={preset.name === chosen ? "turing-green" : "bw"}
              onClick={() => setChosen(preset.name)}
            >
              {preset.name}
            </Button>
          ))}
        </div>
        {summary && <div className="text-sm opacity-80">{summary}</div>}

        {chosen === "trunk" && (
          <div className="flex flex-col gap-2">
            <div className="text-sm opacity-80">
              {t("switchConfig.trunkNote")}
            </div>
            <Input
              name="mgmt-vid"
              label={t("switchConfig.managementVid")}
              value={mgmtVid}
              onChange={(e) => setMgmtVid(e.target.value)}
            />
            <Input
              name="node-vid"
              label={t("switchConfig.nodeVid")}
              value={nodeVid}
              onChange={(e) => setNodeVid(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={redundant}
                onChange={(e) => setRedundant(e.target.checked)}
              />
              {t("switchConfig.redundant")}
            </label>
            {!trunkNumbersLook && (
              <div className="text-sm opacity-80">
                {t("switchConfig.trunkNumbers", {
                  min: limits.vid_min,
                  max: limits.vid_max,
                })}
              </div>
            )}
          </div>
        )}

        {/* The preset's own table, from the board. Always one click away,
            because "what does Split actually do" is the question everybody
            asks and nobody should have to guess at. */}
        <div>
          <button
            type="button"
            className="text-sm underline opacity-80"
            onClick={() => setShowTable((shown) => !shown)}
          >
            {showTable
              ? t("switchConfig.hideTable")
              : t("switchConfig.showTable")}
          </button>
          {showTable && preview && (
            <div className="mt-2">
              <PortTable document={preview} />
            </div>
          )}
        </div>

        <div>
          <Button
            type="button"
            disabled={pending !== null || apply.isPending || !trunkNumbersLook}
            onClick={() => setConfirming(true)}
          >
            {t("switchConfig.apply")}
          </Button>
        </div>
        {pending !== null && (
          <div className="text-sm opacity-80">
            {t("switchConfig.oneAtATime")}
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          applyNow();
        }}
        title={t("switchConfig.apply")}
        message={t("switchConfig.applyWarning", {
          seconds: state.data.default_window_s,
        })}
      />
    </div>
  );
}
