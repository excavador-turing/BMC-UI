import { filesize } from "filesize";
import { TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import ConfirmationModal from "@/components/ConfirmationModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  epochMillis,
  type SwitchDocument,
  type SwitchPort,
  useSwitchPortsQuery,
  useSwitchPresetsQuery,
  useSwitchQuery,
  useSwitchValidationQuery,
} from "@/lib/api/get";
import {
  useApplySwitchMutation,
  useConfirmSwitchMutation,
  useRevertSwitchMutation,
} from "@/lib/api/set";

/** The ports, in the order they sit on the board. */
const PORT_ORDER = ["node1", "node2", "node3", "node4", "bmc", "ge0", "ge1"];

/** The one port that has no cable and no link state: the CPU port. */
const BMC_PORT = "bmc";

const human = (bytes: number) => filesize(bytes, { standard: "jedec" });

/**
 * The document being edited, held as the text that is in the boxes.
 *
 * Text rather than numbers, because a half-typed VLAN list is a legitimate
 * state of a text box and a document that cannot hold it would fight the
 * person typing. Turning it into a document is `documentFrom`, and the one
 * judgement this file makes is whether that succeeds.
 */
interface PortDraft {
  untagged: string;
  tagged: string;
}

interface Draft {
  filtering: boolean;
  stp: boolean;
  ports: Record<string, PortDraft>;
  names: Record<string, string>;
}

function draftFrom(document: SwitchDocument): Draft {
  const ports: Record<string, PortDraft> = {};
  for (const name of PORT_ORDER) {
    const port = document.ports[name];
    ports[name] = {
      untagged: port?.untagged == null ? "" : String(port.untagged),
      tagged: (port?.tagged ?? []).join(", "),
    };
  }
  return {
    filtering: document.vlan_filtering,
    stp: document.stp,
    ports,
    names: { ...(document.names ?? {}) },
  };
}

/** A VLAN number as typed. `null` is "that is not a number". */
function vid(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "" || !/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

/**
 * Which cells do not parse, as `port.field` keys.
 *
 * The only rule this client owns. Whether 4095 is a legal VLAN, whether the
 * BMC may be tagged, whether two uplinks may share a VLAN -- all of that is
 * the board's, asked over the wire on every edit. A copy of those rules here
 * would eventually disagree with the board, and the way that disagreement
 * shows up is a board nobody can reach.
 */
function unparsed(draft: Draft): Set<string> {
  const bad = new Set<string>();
  for (const name of PORT_ORDER) {
    const port = draft.ports[name];
    if (port.untagged.trim() !== "" && vid(port.untagged) === null) {
      bad.add(`${name}.untagged`);
    }
    for (const piece of port.tagged.split(",")) {
      if (piece.trim() !== "" && vid(piece) === null) {
        bad.add(`${name}.tagged`);
      }
    }
  }
  return bad;
}

/** The draft as a document, or null while something does not parse. */
function documentFrom(draft: Draft): SwitchDocument | null {
  if (unparsed(draft).size > 0) return null;

  const ports: SwitchDocument["ports"] = {};
  for (const name of PORT_ORDER) {
    const port = draft.ports[name];
    const tagged = port.tagged
      .split(",")
      .map((piece) => vid(piece))
      .filter((value): value is number => value !== null);
    ports[name] = {
      untagged: vid(port.untagged),
      tagged: [...new Set(tagged)].sort((a, b) => a - b),
    };
  }

  // An empty name is not a name, and the board refuses one. Dropping it here
  // means clearing a box is how you remove a name, which is what somebody
  // clearing a box means.
  const names: Record<string, string> = {};
  for (const [key, value] of Object.entries(draft.names)) {
    if (value.trim() !== "") names[key] = value.trim();
  }

  return { vlan_filtering: draft.filtering, stp: draft.stp, ports, names };
}

/** Every VLAN the draft mentions, ascending. What there is to name. */
function vlansOf(document: SwitchDocument): number[] {
  const seen = new Set<number>();
  for (const port of Object.values(document.ports)) {
    if (port.untagged !== null) seen.add(port.untagged);
    for (const tag of port.tagged) seen.add(tag);
  }
  return [...seen].sort((a, b) => a - b);
}

/** A value that follows another one, late. */
function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return settled;
}

/**
 * What a port's cable is doing, in one short phrase.
 *
 * Three states and they are not the same kind of news. **Not probed** is red:
 * the switch driver never saw the port, so a module is cut off while the BMC
 * reporting it stays perfectly reachable -- the failure that used to be
 * invisible here. **Down** is amber and ordinary for an unplugged uplink.
 * **Up** carries the negotiated rate, because a gigabit port that came up at
 * 100/half is a bad cable and reads as fine everywhere else.
 */
function LinkCell({ port }: { port: SwitchPort | undefined }) {
  const { t } = useTranslation();

  if (!port) return <span className="opacity-40">—</span>;

  if (!port.present) {
    return (
      <span className="font-semibold text-red-600 dark:text-red-400">
        {t("network.switchPortAbsent")}
      </span>
    );
  }

  if (!port.link) {
    return (
      <span className="text-amber-600 dark:text-amber-500">
        {t("network.switchPortDown")}
      </span>
    );
  }

  // "1 Gb", not "1000 Mb/s · full duplex". The long form was most of the
  // table's width and pushed it into a horizontal scrollbar in a column.
  // Half duplex is the one that matters -- a gigabit port that negotiated
  // half is a bad cable -- so it is the only duplex worth the space.
  const speed = port.speed_mbps ?? null;
  const rate =
    speed === null
      ? ""
      : speed >= 1000
        ? `${String(speed / 1000)} Gb`
        : `${String(speed)} Mb`;
  const half =
    port.duplex === "half" ? t("network.switchPortDuplexHalf") : null;

  return (
    <span className="whitespace-nowrap">
      {t("network.switchPortUp")}
      {rate !== "" && <span className="ml-2 opacity-60">{rate}</span>}
      {half && (
        <span className="ml-2 text-amber-600 dark:text-amber-500">{half}</span>
      )}
    </span>
  );
}

/** Cumulative since the switch came up, so a down port with bytes behind it
 * is a link that dropped rather than one that never came up. */
function TrafficCell({ port }: { port: SwitchPort | undefined }) {
  const { t } = useTranslation();
  if (!port?.present) return <span className="opacity-40">—</span>;

  const errors = (port.rx_errors ?? 0) + (port.tx_errors ?? 0);
  return (
    <span className="opacity-60">
      {t("network.switchPortTraffic", {
        rx: human(port.rx_bytes ?? 0),
        tx: human(port.tx_bytes ?? 0),
      })}
      {errors > 0 && (
        <span className="ml-2 text-amber-600 dark:text-amber-500">
          {t("network.switchPortErrors", {
            rx: port.rx_errors,
            tx: port.tx_errors,
          })}
        </span>
      )}
    </span>
  );
}

interface TableProps {
  draft: Draft;
  ports: SwitchPort[] | undefined;
  showTraffic: boolean;
  /** Absent means the board cannot be configured from here: read-only. */
  onChange?: (next: Draft) => void;
  warningsFor: (port: string) => string[];
  bad: Set<string>;
}

/**
 * The seven ports, one row each, and the row is where you change them.
 *
 * One table rather than two. Link state and VLAN membership used to be
 * separate panels about the same seven things, and answering "is node 3's
 * cable in, and which network is it on" meant matching names between them.
 *
 * The BMC's row is marked and its tagged cell cannot be typed in: this board
 * reads untagged frames only, so a tag there is traffic it cannot see, and
 * the board refuses such a document. Saying so with a disabled box is kinder
 * than saying it with a refusal after the fact.
 */
function PortTable({
  draft,
  ports,
  showTraffic,
  onChange,
  warningsFor,
  bad,
}: TableProps) {
  const { t } = useTranslation();
  const byName = new Map((ports ?? []).map((port) => [port.name, port]));
  const editable = onChange !== undefined;

  const set = (name: string, field: keyof PortDraft, value: string) => {
    if (!onChange) return;
    onChange({
      ...draft,
      ports: {
        ...draft.ports,
        [name]: { ...draft.ports[name], [field]: value },
      },
    });
  };

  const cell = "px-2 py-0.5 align-top";
  // With filtering off the switch does not read this table at all. It is
  // still editable -- setting a layout up and then turning filtering on is
  // the sane order -- but showing it at full strength would be showing
  // numbers that mean nothing yet.
  const vlanCell = draft.filtering ? cell : `${cell} opacity-50`;

  return (
    <div className="overflow-x-auto">
      {!draft.filtering && (
        <div className="mb-2 max-w-3xl text-sm opacity-80">
          {t("switchConfig.oneNetwork")}
        </div>
      )}
      <table className="w-full max-w-3xl border-collapse text-sm">
        <thead>
          <tr className="text-left opacity-60">
            <th className={`${cell} font-normal`}>{t("switchConfig.port")}</th>
            <th className={`${cell} font-normal`}>{t("switchConfig.link")}</th>
            {showTraffic && (
              <th className={`${cell} font-normal`}>
                {t("switchConfig.traffic")}
              </th>
            )}
            <th className={`${cell} font-normal`}>
              {t("switchConfig.untagged")}
            </th>
            <th className={`${cell} font-normal`}>
              {t("switchConfig.tagged")}
            </th>
          </tr>
        </thead>
        <tbody>
          {PORT_ORDER.map((name) => {
            const port = draft.ports[name];
            const warnings = warningsFor(name);
            const isBmc = name === BMC_PORT;
            return (
              <tr
                key={name}
                className="border-t border-neutral-200 dark:border-neutral-700"
              >
                <td className={`${cell} font-mono`}>
                  {name}
                  {isBmc && (
                    <span className="ml-2 font-sans text-xs whitespace-nowrap opacity-60">
                      {t("switchConfig.thisBoard")}
                    </span>
                  )}
                </td>
                <td className={cell}>
                  {isBmc ? (
                    <span className="opacity-40">—</span>
                  ) : (
                    <LinkCell port={byName.get(name)} />
                  )}
                </td>
                {showTraffic && (
                  <td className={cell}>
                    {isBmc ? (
                      <span className="opacity-40">—</span>
                    ) : (
                      <TrafficCell port={byName.get(name)} />
                    )}
                  </td>
                )}
                <td className={vlanCell}>
                  {editable ? (
                    <input
                      className={`w-20 border bg-transparent px-1 py-0.5 font-mono ${
                        bad.has(`${name}.untagged`)
                          ? "border-red-500"
                          : "border-neutral-300 dark:border-neutral-600"
                      }`}
                      aria-label={t("switchConfig.untaggedOn", { port: name })}
                      value={port.untagged}
                      placeholder={t("switchConfig.none")}
                      onChange={(e) => set(name, "untagged", e.target.value)}
                    />
                  ) : (
                    <span className="font-mono">{port.untagged || "—"}</span>
                  )}
                  {warnings.length > 0 && (
                    <div className="mt-1 max-w-xs text-xs text-amber-700 dark:text-amber-500">
                      {warnings.join(" ")}
                    </div>
                  )}
                </td>
                <td className={vlanCell}>
                  {editable ? (
                    <input
                      className={`w-32 border bg-transparent px-1 py-0.5 font-mono ${
                        bad.has(`${name}.tagged`)
                          ? "border-red-500"
                          : "border-neutral-300 dark:border-neutral-600"
                      } disabled:opacity-40`}
                      aria-label={t("switchConfig.taggedOn", { port: name })}
                      value={isBmc ? "" : port.tagged}
                      disabled={isBmc}
                      placeholder={
                        isBmc ? t("switchConfig.never") : t("switchConfig.none")
                      }
                      title={
                        isBmc ? t("switchConfig.bmcUntaggedOnly") : undefined
                      }
                      onChange={(e) => set(name, "tagged", e.target.value)}
                    />
                  ) : (
                    <span className="font-mono">{port.tagged || "—"}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The on-board switch: what each port is doing, and which ports can talk to
 * which.
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
 * TWO THINGS THIS CARD NEVER DOES. It never expands a preset itself -- the
 * board returns each preset's full table -- and it never judges a document.
 * Both for the same reason: a client that computed its own answer would
 * eventually disagree with the board, and the way that disagreement surfaces
 * is a board nobody can reach.
 *
 * The port table is shown even on a board whose daemon has no switch
 * configuration at all. Link state is the older, smaller feature and the one
 * people arrive looking for; losing it because the board cannot be configured
 * would be a worse trade than showing a table with two columns fewer.
 */
export default function SwitchConfig() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const state = useSwitchQuery();
  const presets = useSwitchPresetsQuery();
  const portsQuery = useSwitchPortsQuery();
  const apply = useApplySwitchMutation();
  const confirm = useConfirmSwitchMutation();
  const revert = useRevertSwitchMutation();

  const [edited, setEdited] = useState<Draft | null>(null);
  const [showTraffic, setShowTraffic] = useState(false);
  /**
   * Seconds to confirm within, or null while the board's default stands.
   *
   * Null rather than a number, so an untouched card sends no `window_s` at
   * all and the board decides. Hard-coding 30 here would be this page having
   * an opinion about a default the daemon publishes.
   */
  const [window_s, setWindow] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [tried, setTried] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const pending = state.data?.pending ?? null;
  useEffect(() => {
    if (!pending?.counting_from) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [pending?.counting_from]);

  // Until somebody edits something, the table follows the board. Derived
  // rather than copied into state on arrival, so a card nobody has touched
  // never shows a configuration the board has moved on from.
  const running = state.data?.running ?? null;
  const draft = useMemo(
    () => edited ?? (running ? draftFrom(running) : null),
    [edited, running]
  );

  const proposed = draft ? documentFrom(draft) : null;
  const settled = useDebounced(proposed ? JSON.stringify(proposed) : null, 400);
  const edits = edited !== null;
  // Nothing is asked of the board until something has been changed: the
  // running configuration is one the board is already living with.
  const verdict = useSwitchValidationQuery(
    edits && settled !== null ? (JSON.parse(settled) as SwitchDocument) : null
  );

  const ports = portsQuery.data;
  const unprobed = ports?.some((port) => !port.present) ?? false;
  const empty = ports?.length === 0;

  // The board's own published range. Undefined only while the presets query
  // is in flight or on a daemon too old to have them -- in which case the
  // control is not rendered and there is nothing to bound.
  const limits = presets.data?.limits;

  const configurable =
    !state.isError && state.data != null && !presets.isError && presets.data;

  const bad = draft ? unparsed(draft) : new Set<string>();
  const refusal = verdict.data?.refusal?.reason ?? null;
  const warnings = verdict.data?.warnings ?? [];
  const warningsFor = (port: string) =>
    warnings.filter((w) => w.port === port).map((w) => w.reason);
  const generalWarnings = warnings
    .filter((w) => w.port === null)
    .map((w) => w.reason);

  // The board's rule, read from the board, so an out-of-range window greys
  // the button out instead of being sent to be refused.
  const windowOk =
    window_s === null ||
    limits === undefined ||
    (Number.isInteger(window_s) &&
      window_s >= limits.window_min_s &&
      window_s <= limits.window_max_s);

  const canApply =
    proposed !== null &&
    edits &&
    windowOk &&
    refusal === null &&
    verdict.isSuccess &&
    pending === null &&
    !apply.isPending;

  const send = (why: "apply" | "try") => {
    if (!proposed) return;
    setTried(why === "try");
    // The daemon flattens the proposal, so `window_s` rides alongside the
    // document's own fields -- proved against bmc-2 before this was written.
    const body =
      window_s === null ? proposed : { ...proposed, window_s: window_s };
    apply.mutate(body, {
      onSuccess: () => {
        setEdited(null);
        toast({
          title: t("switchConfig.applied"),
          description:
            why === "try"
              ? t("switchConfig.triedNote")
              : t("switchConfig.appliedNote"),
        });
      },
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
    const from = epochMillis(pending.counting_from);
    if (from === null) return null;
    const deadline = from + pending.window_s * 1000;
    return Math.max(0, Math.round((deadline - now) / 1000));
  })();

  const vlans = proposed ? vlansOf(proposed) : [];

  return (
    <div>
      <div className="mb-6 text-lg font-bold">{t("switchConfig.title")}</div>

      {portsQuery.isError && (
        <p className="mb-4 text-sm opacity-60">
          {t("network.switchPortsUnavailable")}
        </p>
      )}

      {(unprobed || empty) && (
        <div className="mb-6 flex items-start gap-3 rounded-md border border-red-500 bg-red-500 p-4 text-neutral-100 dark:border-red-900 dark:bg-red-900">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">{t("network.switchNotProbed")}</p>
            <p className="mt-1">
              {empty
                ? t("network.switchNoPorts")
                : t("network.switchNotProbedDescription")}
            </p>
          </div>
        </div>
      )}

      {/* A change that has been applied and not yet kept. The one urgent
          thing on this page, so it comes above everything it is about. */}
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
          {tried && (
            <div className="mt-1 opacity-80">{t("switchConfig.tryingNow")}</div>
          )}
          <div className="mt-3 flex gap-4">
            <Button
              type="button"
              disabled={confirm.isPending}
              onClick={() =>
                confirm.mutate(pending.token, {
                  onSuccess: () => {
                    setTried(false);
                    toast({ title: t("switchConfig.confirmed") });
                  },
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
          {/* The sentence the daemon says when it refuses a confirmation from
              the board's own shell, said here first. */}
          <div className="mt-2 text-xs opacity-80">
            {t("switchConfig.confirmFromHere")}
          </div>
        </div>
      )}

      {!pending && state.data?.last_revert?.reason === "not_confirmed" && (
        <div className="mb-6 text-sm text-amber-700 dark:text-amber-500">
          {t("switchConfig.wasReverted", {
            at: new Date(
              epochMillis(state.data.last_revert.at) ?? 0
            ).toLocaleTimeString(),
          })}
        </div>
      )}

      {/* Presets fill the table below. They are starting points, not modes:
          there is no Custom to enter, and changing a cell afterwards is
          simply editing. The board expands them, never this card. */}
      {configurable && presets.data && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm opacity-60">
            {t("switchConfig.startFrom")}
          </span>
          {presets.data.presets.map((preset) => (
            <Button
              key={preset.name}
              type="button"
              variant="bw"
              title={preset.summary}
              onClick={() => setEdited(draftFrom(preset.document))}
            >
              {preset.name}
            </Button>
          ))}
          {edits && (
            <button
              type="button"
              className="text-sm underline opacity-80"
              onClick={() => setEdited(null)}
            >
              {t("switchConfig.discard")}
            </button>
          )}
        </div>
      )}

      {draft && (
        <PortTable
          draft={draft}
          ports={ports}
          showTraffic={showTraffic}
          onChange={configurable ? setEdited : undefined}
          warningsFor={warningsFor}
          bad={bad}
        />
      )}

      <div className="mt-2">
        <button
          type="button"
          className="text-xs underline opacity-60"
          onClick={() => setShowTraffic((shown) => !shown)}
        >
          {showTraffic
            ? t("switchConfig.hideTraffic")
            : t("switchConfig.showTraffic")}
        </button>
      </div>

      {configurable && draft && (
        <div className="mt-4 flex max-w-3xl flex-col gap-3">
          <div className="flex flex-col gap-2 xl:flex-row xl:gap-6">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={draft.filtering}
                onChange={(e) =>
                  setEdited({ ...draft, filtering: e.target.checked })
                }
              />
              {t("switchConfig.filtering")}
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={draft.stp}
                onChange={(e) => setEdited({ ...draft, stp: e.target.checked })}
              />
              {t("switchConfig.spanningTree")}
            </label>
          </div>

          {/* A word beside a number, so that a layout is still legible to
              whoever opens this board next year. The board carries these and
              never acts on them. */}
          {draft.filtering && vlans.length > 0 && (
            <div>
              <div className="mb-1 text-sm font-semibold">
                {t("switchConfig.names")}
              </div>
              <div className="flex flex-wrap gap-3">
                {vlans.map((v) => (
                  <div key={v} className="w-44">
                    <Input
                      name={`vlan-name-${v}`}
                      label={t("switchConfig.vlanNumber", { vid: v })}
                      value={draft.names[String(v)] ?? ""}
                      placeholder={t("switchConfig.unnamed")}
                      onChange={(e) =>
                        setEdited({
                          ...draft,
                          names: {
                            ...draft.names,
                            [String(v)]: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {bad.size > 0 && (
            <div className="text-sm text-red-600 dark:text-red-400">
              {t("switchConfig.notNumbers")}
            </div>
          )}

          {refusal && (
            <div className="text-sm text-red-600 dark:text-red-400">
              {refusal}
            </div>
          )}

          {generalWarnings.length > 0 && (
            <div className="text-sm text-amber-700 dark:text-amber-500">
              {generalWarnings.join(" ")}
            </div>
          )}

          {verdict.isError && edits && (
            <div className="text-sm opacity-80">
              {t("switchConfig.cannotCheck")}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              disabled={!canApply}
              onClick={() => setConfirming(true)}
            >
              {t("switchConfig.apply")}
            </Button>
            <Button
              type="button"
              variant="bw"
              disabled={!canApply}
              onClick={() => send("try")}
            >
              {t("switchConfig.tryIt")}
            </Button>

            {/* On the same row as the buttons it belongs to, and bounded by
                what the board says it accepts -- never by a number written
                here. Thirty seconds is enough to watch a preset take effect
                and too short to check a layout you made by hand, which is
                exactly when Try it is worth using. */}
            {limits && (
              <label className="flex items-center gap-2 text-sm">
                {t("switchConfig.windowLabel")}
                <input
                  type="number"
                  className="w-16 border border-neutral-300 bg-transparent px-1 py-0.5 dark:border-neutral-600"
                  min={limits.window_min_s}
                  max={limits.window_max_s}
                  step={5}
                  value={window_s ?? limits.window_default_s}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setWindow(Number.isFinite(next) ? next : null);
                  }}
                />
                <span className="whitespace-nowrap opacity-60">
                  {t("switchConfig.windowRange", {
                    min: limits.window_min_s,
                    max: limits.window_max_s,
                  })}
                </span>
              </label>
            )}
          </div>

          {pending !== null && (
            <div className="text-sm opacity-80">
              {t("switchConfig.oneAtATime")}
            </div>
          )}
          {/* One line, not two. "Try it does not keep it" and "this is what
              the board is running" were both permanently on screen; the
              first is only useful once there is something to try. */}
          <div className="text-sm opacity-60">
            {edits ? t("switchConfig.tryItNote") : t("switchConfig.unchanged")}
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          send("apply");
        }}
        title={t("switchConfig.apply")}
        message={t("switchConfig.applyWarning", {
          seconds: window_s ?? state.data?.default_window_s ?? 30,
        })}
      />
    </div>
  );
}
