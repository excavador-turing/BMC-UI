import { filesize } from "filesize";
import { PencilIcon, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import ConfirmationModal from "@/components/ConfirmationModal";
import TextField from "@/components/TextField";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ValidationRefused } from "@/lib/api/get";
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
import { cn } from "@/lib/utils";

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

  if (!port) return <span className="text-muted-foreground">—</span>;

  if (!port.present) {
    return (
      <span className="font-medium text-destructive">
        {t("network.switchPortAbsent")}
      </span>
    );
  }

  if (!port.link) {
    return <span className="text-warning">{t("network.switchPortDown")}</span>;
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
      {rate !== "" && (
        <span className="ml-2 text-muted-foreground">{rate}</span>
      )}
      {half && <span className="ml-2 text-warning">{half}</span>}
    </span>
  );
}

/** Cumulative since the switch came up, so a down port with bytes behind it
 * is a link that dropped rather than one that never came up. */
function TrafficCell({ port }: { port: SwitchPort | undefined }) {
  const { t } = useTranslation();
  if (!port?.present) return <span className="text-muted-foreground">—</span>;

  return (
    <span className="text-muted-foreground">
      {t("network.switchPortTraffic", {
        rx: human(port.rx_bytes ?? 0),
        tx: human(port.tx_bytes ?? 0),
      })}
    </span>
  );
}

/** The port's name, with the BMC's own port marked. */
function PortName({ name }: { name: string }) {
  const { t } = useTranslation();

  return (
    <>
      <span className="font-mono">{name}</span>
      {name === BMC_PORT && (
        <span className="ml-2 text-xs whitespace-nowrap text-muted-foreground">
          {t("switchConfig.thisBoard")}
        </span>
      )}
    </>
  );
}

/**
 * What each port's cable is doing. Read-only, and shown even on a board whose
 * daemon has no switch configuration at all: link state is the older, smaller
 * feature and the one people arrive looking for.
 */
function PortsCard({ ports }: { ports: SwitchPort[] | undefined }) {
  const { t } = useTranslation();
  const byName = new Map((ports ?? []).map((port) => [port.name, port]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("switchConfig.ports")}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("switchConfig.port")}</TableHead>
              <TableHead>{t("switchConfig.link")}</TableHead>
              <TableHead>{t("switchConfig.traffic")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PORT_ORDER.map((name) => (
              <TableRow key={name}>
                <TableCell>
                  <PortName name={name} />
                </TableCell>
                <TableCell>
                  {name === BMC_PORT ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <LinkCell port={byName.get(name)} />
                  )}
                </TableCell>
                <TableCell>
                  {name === BMC_PORT ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <TrafficCell port={byName.get(name)} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/** One VLAN as a badge, with its name when it has one. */
function VlanBadge({ vid, name }: { vid: string; name?: string }) {
  return (
    <Badge variant="outline" className="font-mono">
      {vid}
      {name && <span className="font-sans text-muted-foreground">{name}</span>}
    </Badge>
  );
}

interface VlanTableProps {
  draft: Draft;
  /** Absent means the table is read-only: the view mode. */
  onChange?: (next: Draft) => void;
  warningsFor: (port: string) => string[];
  bad: Set<string>;
}

/**
 * Which VLANs each port is on. Read-only badges until Edit, boxes after.
 *
 * The BMC's tagged cell cannot be typed in: this board reads untagged frames
 * only, so a tag there is traffic it cannot see, and the board refuses such a
 * document. Saying so with a disabled box is kinder than saying it with a
 * refusal after the fact.
 */
function VlanTable({ draft, onChange, warningsFor, bad }: VlanTableProps) {
  const { t } = useTranslation();

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

  const badges = (text: string) => {
    const vids = text
      .split(",")
      .map((piece) => piece.trim())
      .filter((piece) => piece !== "");
    if (vids.length === 0) {
      return <span className="text-muted-foreground">—</span>;
    }
    return (
      <span className="flex flex-wrap gap-1">
        {vids.map((v) => (
          <VlanBadge key={v} vid={v} name={draft.names[v]} />
        ))}
      </span>
    );
  };

  return (
    // With filtering off the switch does not read this table at all. It is
    // still editable -- setting a layout up and then turning filtering on is
    // the sane order -- but showing it at full strength would be showing
    // numbers that mean nothing yet.
    <div className={cn("overflow-x-auto", !draft.filtering && "opacity-50")}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("switchConfig.port")}</TableHead>
            <TableHead>{t("switchConfig.untagged")}</TableHead>
            <TableHead>{t("switchConfig.tagged")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {PORT_ORDER.map((name) => {
            const port = draft.ports[name];
            const warnings = warningsFor(name);
            const isBmc = name === BMC_PORT;
            return (
              <TableRow key={name}>
                <TableCell className="align-top">
                  <PortName name={name} />
                </TableCell>
                <TableCell className="align-top">
                  {onChange ? (
                    <Input
                      className="h-7 w-20 font-mono"
                      aria-invalid={bad.has(`${name}.untagged`)}
                      aria-label={t("switchConfig.untaggedOn", { port: name })}
                      value={port.untagged}
                      placeholder={t("switchConfig.none")}
                      onChange={(e) => set(name, "untagged", e.target.value)}
                    />
                  ) : (
                    badges(port.untagged)
                  )}
                  {warnings.length > 0 && (
                    <div className="mt-1 max-w-xs text-xs whitespace-normal text-warning">
                      {warnings.join(" ")}
                    </div>
                  )}
                </TableCell>
                <TableCell className="align-top">
                  {onChange ? (
                    <Input
                      className="h-7 w-32 font-mono"
                      aria-invalid={bad.has(`${name}.tagged`)}
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
                    badges(isBmc ? "" : port.tagged)
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/** A setting as a switch with a short label and a line of explanation. */
function Toggle({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Field orientation="horizontal" className="items-start">
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <FieldDescription>{description}</FieldDescription>
      </FieldContent>
    </Field>
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
 * So the page never applies anything it keeps. An apply puts the change on
 * the switch and starts a window; confirming is a second request, and the
 * fact that it arrives at all is the proof that the new configuration works.
 * If this page cannot reach the board there is nothing to press, and the
 * board puts the old configuration back by itself. That is the design
 * working, not a failure.
 *
 * TWO THINGS THIS PAGE NEVER DOES. It never expands a preset itself -- the
 * board returns each preset's full table -- and it never judges a document.
 * Both for the same reason: a client that computed its own answer would
 * eventually disagree with the board, and the way that disagreement surfaces
 * is a board nobody can reach.
 *
 * Two cards: the ports, read-only, for the person checking a cable; and the
 * VLANs, read-only until Edit, for the person changing the layout.
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

  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState<Draft | null>(null);
  const [preset, setPreset] = useState<string | null>(null);
  /**
   * Seconds to confirm within, or null while the board's default stands.
   *
   * Null rather than a number, so an untouched dialog sends no `window_s` at
   * all and the board decides. Hard-coding 30 here would be this page having
   * an opinion about a default the daemon publishes.
   */
  const [window_s, setWindow] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
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

  // The board's rule, read from the board: an out-of-range window is pulled
  // into range rather than sent to be refused.
  const windowToSend =
    window_s === null || limits === undefined
      ? window_s
      : Math.min(
          Math.max(Math.round(window_s), limits.window_min_s),
          limits.window_max_s
        );

  const canApply =
    proposed !== null &&
    edits &&
    refusal === null &&
    verdict.isSuccess &&
    pending === null &&
    !apply.isPending;

  const stopEditing = () => {
    setEditing(false);
    setEdited(null);
    setPreset(null);
  };

  const send = () => {
    if (!proposed) return;
    // The daemon flattens the proposal, so `window_s` rides alongside the
    // document's own fields -- proved against bmc-2 before this was written.
    const body =
      windowToSend === null
        ? proposed
        : { ...proposed, window_s: windowToSend };
    apply.mutate(body, {
      onSuccess: () => {
        stopEditing();
        toast({
          title: t("switchConfig.applied"),
          description: t("switchConfig.appliedNote"),
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

  // Everything the board or the parser has to say about the draft, in one
  // place under the table rather than a line each.
  const blocking = [
    ...(bad.size > 0 ? [t("switchConfig.notNumbers")] : []),
    ...(refusal ? [refusal] : []),
  ];
  const notes = [
    ...generalWarnings,
    ...(verdict.isError && edits
      ? [
          verdict.error instanceof ValidationRefused &&
          verdict.error.reason !== null
            ? t("switchConfig.refusedQuestion", {
                reason: verdict.error.reason,
              })
            : t("switchConfig.cannotCheck"),
        ]
      : []),
  ];

  const presetItems = [
    { value: null, label: t("switchConfig.presetPlaceholder") },
    ...(presets.data?.presets ?? []).map((p) => ({
      value: p.name,
      label: p.name,
    })),
  ];

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {portsQuery.isError && (
        <p className="text-sm text-muted-foreground">
          {t("network.switchPortsUnavailable")}
        </p>
      )}

      {(unprobed || empty) && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>{t("network.switchNotProbed")}</AlertTitle>
          <AlertDescription>
            {empty
              ? t("network.switchNoPorts")
              : t("network.switchNotProbedDescription")}
          </AlertDescription>
        </Alert>
      )}

      {/* A change that has been applied and not yet kept. The one urgent
          thing on this page, so it comes above everything it is about. */}
      {pending && (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertTitle>{t("switchConfig.pendingTitle")}</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <p>
              {remaining === null
                ? t("switchConfig.waitingForUplink")
                : t("switchConfig.countdown", { seconds: remaining })}
            </p>
            <div className="flex flex-wrap gap-2">
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
                variant="outline"
                disabled={revert.isPending}
                onClick={() => revert.mutate()}
              >
                {t("switchConfig.revertNow")}
              </Button>
            </div>
            {/* The sentence the daemon says when it refuses a confirmation
                from the board's own shell, said here first. */}
            <p className="text-xs text-muted-foreground">
              {t("switchConfig.confirmFromHere")}
            </p>
          </AlertDescription>
        </Alert>
      )}

      {!pending && state.data?.last_revert?.reason === "not_confirmed" && (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertDescription>
            {t("switchConfig.wasReverted", {
              at: new Date(
                epochMillis(state.data.last_revert.at) ?? 0
              ).toLocaleTimeString(),
            })}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-4 md:gap-6">
        <PortsCard ports={ports} />

        {draft && (
          <Card>
            <CardHeader>
              <CardTitle>{t("switchConfig.vlans")}</CardTitle>
              <CardDescription>
                {draft.filtering
                  ? t("switchConfig.filteringOnNote")
                  : t("switchConfig.oneNetwork")}
              </CardDescription>
              {configurable && !editing && (
                <CardAction>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending !== null}
                    title={
                      pending !== null
                        ? t("switchConfig.oneAtATime")
                        : undefined
                    }
                    onClick={() => setEditing(true)}
                  >
                    <PencilIcon data-icon="inline-start" />
                    {t("switchConfig.edit")}
                  </Button>
                </CardAction>
              )}
            </CardHeader>

            <CardContent className="flex flex-col gap-4">
              {editing && configurable ? (
                <>
                  {/* Presets fill the table below. They are starting points,
                      not modes: changing a cell afterwards is simply editing.
                      The board expands them, never this page. */}
                  <Select
                    items={presetItems}
                    value={preset}
                    onValueChange={(value) => {
                      const chosen = presets.data?.presets.find(
                        (p) => p.name === value
                      );
                      if (!chosen) return;
                      setPreset(chosen.name);
                      setEdited(draftFrom(chosen.document));
                    }}
                  >
                    <SelectTrigger
                      aria-label={t("switchConfig.startFrom")}
                      className="w-56"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {presets.data?.presets.map((p) => (
                          <SelectItem key={p.name} value={p.name}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>

                  <div className="flex flex-col gap-3">
                    <Toggle
                      id="switch-filtering"
                      label={t("switchConfig.filteringShort")}
                      description={t("switchConfig.filtering")}
                      checked={draft.filtering}
                      onChange={(checked) =>
                        setEdited({ ...draft, filtering: checked })
                      }
                    />
                    <Toggle
                      id="switch-stp"
                      label={t("switchConfig.stpShort")}
                      description={t("switchConfig.spanningTree")}
                      checked={draft.stp}
                      onChange={(checked) =>
                        setEdited({ ...draft, stp: checked })
                      }
                    />
                  </div>

                  <VlanTable
                    draft={draft}
                    onChange={setEdited}
                    warningsFor={warningsFor}
                    bad={bad}
                  />

                  {/* A word beside a number, so that a layout is still
                      legible to whoever opens this board next year. The board
                      carries these and never acts on them. */}
                  {draft.filtering && vlans.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <div className="text-sm font-medium">
                        {t("switchConfig.names")}
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {vlans.map((v) => (
                          <div key={v} className="w-40">
                            <TextField
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

                  {(blocking.length > 0 || notes.length > 0) && (
                    <Alert
                      variant={blocking.length > 0 ? "destructive" : "warning"}
                    >
                      <TriangleAlert />
                      <AlertDescription className="flex flex-col gap-1">
                        {[...blocking, ...notes].map((line) => (
                          <p key={line}>{line}</p>
                        ))}
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              ) : (
                <>
                  {/* The same switches as in edit mode, greyed out, so the
                      two modes look alike and only one of them moves. */}
                  <div className="flex flex-col gap-3">
                    <Toggle
                      id="switch-filtering-view"
                      label={t("switchConfig.filteringShort")}
                      description={t("switchConfig.filtering")}
                      checked={draft.filtering}
                      disabled
                    />
                    <Toggle
                      id="switch-stp-view"
                      label={t("switchConfig.stpShort")}
                      description={t("switchConfig.spanningTree")}
                      checked={draft.stp}
                      disabled
                    />
                  </div>
                  <VlanTable
                    draft={draft}
                    warningsFor={() => []}
                    bad={new Set()}
                  />
                </>
              )}
            </CardContent>

            {editing && configurable && (
              <CardFooter className="justify-end gap-2 border-t py-3">
                <Button type="button" variant="outline" onClick={stopEditing}>
                  {t("ui.cancel")}
                </Button>
                <Button
                  type="button"
                  disabled={!canApply}
                  onClick={() => setConfirming(true)}
                >
                  {t("switchConfig.apply")}
                </Button>
              </CardFooter>
            )}
          </Card>
        )}
      </div>

      <ConfirmationModal
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          send();
        }}
        title={t("switchConfig.apply")}
        message={
          <div className="flex flex-col gap-4">
            <p>
              {t("switchConfig.applyWarning", {
                seconds:
                  window_s ??
                  limits?.window_default_s ??
                  state.data?.default_window_s ??
                  30,
              })}
            </p>
            {/* Bounded by what the board says it accepts -- never by a
                number written here. Thirty seconds is enough to watch a
                preset take effect and short for a layout made by hand. */}
            {limits && (
              <label className="flex flex-wrap items-center gap-2 text-sm text-foreground">
                {t("switchConfig.windowLabel")}
                <Input
                  type="number"
                  className="h-7 w-20"
                  min={limits.window_min_s}
                  max={limits.window_max_s}
                  step={5}
                  value={window_s ?? limits.window_default_s}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setWindow(Number.isFinite(next) ? next : null);
                  }}
                />
                <span className="whitespace-nowrap text-muted-foreground">
                  {t("switchConfig.windowRange", {
                    min: limits.window_min_s,
                    max: limits.window_max_s,
                  })}
                </span>
              </label>
            )}
          </div>
        }
      />
    </div>
  );
}
