import { TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import ConfirmationModal from "@/components/ConfirmationModal";
import TextField from "@/components/TextField";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  applyBody,
  applyFailedShown,
  managedPresent,
  needsReplaceConsent,
  orderInterfaces,
  timeMillis,
} from "@/lib/api/addressView";
import { bmcdMessage } from "@/lib/api/bmcdMessage";
import {
  type AddressDocument,
  type AddressInterface,
  epochMillis,
  useAddressLimitsQuery,
  useAddressQuery,
  useAddressValidationQuery,
} from "@/lib/api/get";
import {
  useApplyAddressMutation,
  useConfirmAddressMutation,
  useRevertAddressMutation,
} from "@/lib/api/set";

/** What the person is typing; strings, so a half-typed address is allowed. */
interface Draft {
  mode: "dhcp" | "static";
  cidr: string;
  gateway: string;
  dns: string;
  search: string;
}

function draftFrom(document: AddressDocument): Draft {
  if (document.mode === "dhcp") {
    return { mode: "dhcp", cidr: "", gateway: "", dns: "", search: "" };
  }
  return {
    mode: "static",
    cidr: `${document.address}/${document.prefix}`,
    gateway: document.gateway ?? "",
    dns: document.dns.join(", "),
    search: document.search ?? "",
  };
}

/**
 * The document a draft means, or null while it cannot be one yet.
 *
 * The client's only judgement is whether what was typed has the shape of an
 * address; whether it is a *usable* one is the board's, asked over the wire.
 */
function documentFrom(draft: Draft): AddressDocument | null {
  if (draft.mode === "dhcp") return { mode: "dhcp" };
  const [address, prefixText] = draft.cidr.split("/");
  const prefix = Number(prefixText);
  if (!address || !/^\d{1,3}(\.\d{1,3}){3}$/.test(address.trim())) return null;
  if (!Number.isInteger(prefix)) return null;
  const dns = draft.dns
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    mode: "static",
    address: address.trim(),
    prefix,
    gateway: draft.gateway.trim() || null,
    dns,
    search: draft.search.trim() || null,
  };
}

/** What was typed, or -- if nothing was -- what the bridge has. */
function typedOr(typed: string, live: string | null): string {
  return typed !== "" ? typed : (live ?? "");
}

function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return settled;
}

/**
 * Every interface the board has, read-only. The card edits one bridge; this is
 * the whole picture, so a person on a layout the card does not manage can see
 * what the board is actually doing. Rows wrap rather than widen: a CIDR and a
 * MAC side by side do not fit a phone.
 */
function InterfaceList({ interfaces }: { interfaces: AddressInterface[] }) {
  const { t } = useTranslation();
  if (interfaces.length === 0) return null;

  return (
    <ul
      className="flex max-w-2xl flex-col divide-y rounded-lg border text-sm"
      data-testid="address-interfaces"
    >
      {interfaces.map((i) => (
        <li
          key={i.name}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2"
        >
          <span className="font-mono font-medium">{i.name}</span>
          {i.default_route === true && (
            <Badge variant="secondary">{t("addressCard.defaultRoute")}</Badge>
          )}
          <span className="min-w-0 break-all">
            {i.addresses.length > 0
              ? i.addresses.join(", ")
              : t("addressCard.noAddress")}
          </span>
          {i.mac && (
            <span className="font-mono text-xs break-all text-muted-foreground">
              {i.mac}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function words(document: AddressDocument, t: (k: string) => string): string {
  if (document.mode === "dhcp") return t("addressCard.dhcp");
  let out = `${document.address}/${document.prefix}`;
  if (document.gateway) out += ` → ${document.gateway}`;
  return out;
}

/**
 * The BMC's own address: DHCP or static, applied then confirmed.
 *
 * The same shape as the switch card and for the same reason: the address is
 * how you reach this page, and a wrong one is otherwise a trip to the rack.
 * Apply puts it on the bridge; the board reverts unless a confirmation
 * reaches it *at the new address* -- which means this page, reloaded there.
 */
export default function AddressCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const state = useAddressQuery();
  const limits = useAddressLimitsQuery().data;
  const apply = useApplyAddressMutation();
  const confirm = useConfirmAddressMutation();
  const revert = useRevertAddressMutation();

  const running = state.data?.running ?? null;
  const [edited, setEdited] = useState<Draft | null>(null);
  const draft = edited ?? (running ? draftFrom(running) : null);
  const edits = edited !== null;
  // What the dialog is asking about: an apply, or a try. Null when closed.
  const [asking, setAsking] = useState<"apply" | "try" | null>(null);
  const [tried, setTried] = useState(false);
  const [window_s, setWindow] = useState<number | null>(null);

  const proposed = useMemo(
    () => (draft && edits ? documentFrom(draft) : null),
    [draft, edits]
  );
  const settled = useDebounced(proposed ? JSON.stringify(proposed) : null, 400);
  const verdict = useAddressValidationQuery(
    settled ? (JSON.parse(settled) as AddressDocument) : null
  );

  const pending = state.data?.pending ?? null;
  const [now, setNow] = useState(() => Date.now());
  // The clock runs every second while a change is waiting, and slowly
  // otherwise: a banner that expires has to notice that it has, even when the
  // poll brings nothing new to render.
  const counting = pending !== null;
  useEffect(() => {
    const id = window.setInterval(
      () => setNow(Date.now()),
      counting ? 1000 : 15000
    );
    return () => window.clearInterval(id);
  }, [counting]);

  // An older daemon has no such endpoint; the card is not shown as broken.
  if (state.isError) return null;
  if (!state.data || !draft) return null;

  const live = state.data.live;
  const applied = epochMillis(pending?.applied_at);
  const remaining =
    pending && applied !== null
      ? Math.max(
          0,
          Math.round((applied + pending.window_s * 1000 - now) / 1000)
        )
      : null;

  const present = managedPresent(state.data);
  const interfaces = orderInterfaces(state.data.interfaces);
  const consent = needsReplaceConsent(state.data);
  const lastRevert = state.data.last_revert;

  const windowOk =
    window_s === null ||
    limits === undefined ||
    (Number.isInteger(window_s) &&
      window_s >= limits.window_min_s &&
      window_s <= limits.window_max_s);
  const canApply =
    edits &&
    proposed !== null &&
    verdict.data?.refusal == null &&
    !verdict.isError &&
    pending === null &&
    present &&
    windowOk &&
    !apply.isPending;

  const send = (how: "apply" | "try") => {
    if (!proposed) return;
    // Asking was the dialog's job; reaching here with a hand-written file
    // means it was answered yes.
    apply.mutate(applyBody(proposed, window_s, consent), {
      onSuccess: () => {
        setTried(how === "try");
        setEdited(null);
        toast({
          title: t("addressCard.applied"),
          description: t("addressCard.appliedNote"),
        });
      },
      onError: (e: Error) =>
        toast({
          title: t("addressCard.applyFailed"),
          description: bmcdMessage(e),
          variant: "destructive",
        }),
    });
  };

  const set = (patch: Partial<Draft>) => setEdited({ ...draft, ...patch });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("addressCard.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {pending && (
          <Alert variant="warning">
            <TriangleAlert />
            <AlertTitle>
              {t("addressCard.pendingTitle", {
                address: words(pending.document, t),
              })}
            </AlertTitle>
            <AlertDescription className="flex flex-col gap-3">
              <p>
                {remaining === null
                  ? t("addressCard.pendingNoClock")
                  : t("addressCard.countdown", { seconds: remaining })}
                {tried && <> {t("addressCard.tryingNow")}</>}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={confirm.isPending}
                  onClick={() =>
                    confirm.mutate(pending.token, {
                      onSuccess: () => {
                        setTried(false);
                        toast({ title: t("addressCard.confirmed") });
                      },
                      onError: (e: Error) =>
                        toast({
                          title: t("addressCard.confirmFailed"),
                          description: bmcdMessage(e),
                          variant: "destructive",
                        }),
                    })
                  }
                >
                  {t("addressCard.confirm")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={revert.isPending}
                  onClick={() =>
                    revert.mutate(undefined, {
                      onError: (e: Error) =>
                        toast({
                          title: t("addressCard.revertFailed"),
                          description: bmcdMessage(e),
                          variant: "destructive",
                        }),
                    })
                  }
                >
                  {t("addressCard.revertNow")}
                </Button>
              </div>
              {/* The one thing this card must say: a confirmation only counts
              from the new address. This page, reached at the old one, is
              about to stop answering. */}
              <p className="text-xs text-muted-foreground">
                {t("addressCard.confirmFromThere")}
              </p>
            </AlertDescription>
          </Alert>
        )}

        {!pending && lastRevert?.reason === "not_confirmed" && (
          <div className="text-sm text-warning">
            {t("addressCard.wasReverted", {
              at: new Date(timeMillis(lastRevert.at) ?? 0).toLocaleTimeString(),
            })}
          </div>
        )}
        {!pending && applyFailedShown(lastRevert, now) && lastRevert && (
          <div className="flex flex-col gap-1 text-sm text-destructive">
            <p>
              {t("addressCard.applyFailedRevert", {
                at: new Date(
                  timeMillis(lastRevert.at) ?? 0
                ).toLocaleTimeString(),
              })}
            </p>
            {lastRevert.detail && (
              <p className="break-words">{lastRevert.detail}</p>
            )}
          </div>
        )}

        {!present && (
          <Alert variant="warning" data-testid="address-no-bridge">
            <TriangleAlert />
            <AlertTitle>
              {t("addressCard.noBridgeTitle", {
                name: state.data.managed_interface ?? "br0",
              })}
            </AlertTitle>
            <AlertDescription>
              {t("addressCard.noBridgeBody", {
                name: state.data.managed_interface ?? "br0",
              })}
            </AlertDescription>
          </Alert>
        )}

        {state.data.file === "unreadable" && present && (
          <p className="text-sm text-warning">
            {t("addressCard.fileUnreadable")}
          </p>
        )}
        {state.data.file === "hand_edited" && present && (
          <p className="text-sm text-warning">
            {t("addressCard.fileHandEdited")}
          </p>
        )}
        {state.data.file_backup && (
          <p className="text-sm break-all text-muted-foreground">
            {t("addressCard.fileKept", { path: state.data.file_backup })}
          </p>
        )}

        <Field className="max-w-sm">
          <FieldLabel htmlFor="address-mode">
            {t("addressCard.mode")}
          </FieldLabel>
          <Select
            name="mode"
            items={[
              { value: "dhcp", label: t("addressCard.dhcp") },
              { value: "static", label: t("addressCard.static") },
            ]}
            value={draft.mode}
            disabled={pending !== null || !present}
            onValueChange={(value) => {
              const mode = value;
              if (mode === null) return;
              set(
                mode === "dhcp"
                  ? { mode }
                  : {
                      mode,
                      // Start a static draft from what the bridge has now:
                      // the address a person wants to fix is usually the one
                      // the lease gave them.
                      cidr: typedOr(draft.cidr, live.address),
                      gateway: typedOr(draft.gateway, live.gateway),
                      dns: typedOr(draft.dns, live.dns.join(", ")),
                      search: typedOr(draft.search, live.search),
                    }
              );
            }}
          >
            <SelectTrigger
              id="address-mode"
              data-testid="address-mode"
              className="w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="dhcp">{t("addressCard.dhcp")}</SelectItem>
                <SelectItem value="static">
                  {t("addressCard.static")}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        {draft.mode === "static" && (
          <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
            <TextField
              name="address"
              label={t("addressCard.addressLabel")}
              value={draft.cidr}
              spellCheck={false}
              placeholder="192.168.1.20/24"
              disabled={pending !== null || !present}
              onChange={(e) => set({ cidr: e.target.value })}
            />
            <TextField
              name="gateway"
              label={t("addressCard.gatewayLabel")}
              value={draft.gateway}
              spellCheck={false}
              placeholder="192.168.1.1"
              disabled={pending !== null || !present}
              onChange={(e) => set({ gateway: e.target.value })}
            />
            <TextField
              name="dns"
              label={t("addressCard.dnsLabel")}
              value={draft.dns}
              spellCheck={false}
              placeholder="192.168.1.1, 1.1.1.1"
              disabled={pending !== null || !present}
              onChange={(e) => set({ dns: e.target.value })}
            />
            <TextField
              name="search"
              label={t("addressCard.searchLabel")}
              value={draft.search}
              spellCheck={false}
              placeholder="home.lan"
              disabled={pending !== null || !present}
              onChange={(e) => set({ search: e.target.value })}
            />
          </div>
        )}

        {/* The board's verdict, as the board words it. */}
        {edits && proposed === null && draft.mode === "static" && (
          <div className="text-sm text-muted-foreground">
            {t("addressCard.incomplete")}
          </div>
        )}
        {verdict.data?.refusal && (
          <div className="text-sm font-medium text-destructive">
            {verdict.data.refusal.reason}
          </div>
        )}
        {verdict.data?.refusal == null &&
          verdict.data?.warnings.map((w) => (
            <div key={w.reason} className="text-sm text-warning">
              {w.reason}
            </div>
          ))}
        {verdict.isError && (
          <div className="text-sm text-muted-foreground">
            {t("addressCard.cannotCheck")}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={!canApply}
            onClick={() => setAsking("apply")}
          >
            {t("addressCard.apply")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!canApply}
            onClick={() => (consent ? setAsking("try") : send("try"))}
          >
            {t("addressCard.tryIt")}
          </Button>
          {/* The window only times an edit, so it waits for one. */}
          {limits && edits && (
            <label className="flex items-center gap-2 text-sm">
              {t("addressCard.windowLabel")}
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
                {t("addressCard.windowRange", {
                  min: limits.window_min_s,
                  max: limits.window_max_s,
                })}
              </span>
            </label>
          )}
          {edits && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setEdited(null)}
            >
              {t("addressCard.discard")}
            </Button>
          )}
        </div>
        {edits && (
          <p className="text-sm text-muted-foreground">
            {t("addressCard.tryItNote")}
          </p>
        )}

        {/* The board as a whole, read-only. Under the form on a layout the
            form manages; the only thing worth reading on one it does not. */}
        <InterfaceList interfaces={interfaces} />

        <ConfirmationModal
          isOpen={asking !== null}
          onClose={() => setAsking(null)}
          onConfirm={() => {
            const how = asking;
            setAsking(null);
            if (how !== null) send(how);
          }}
          title={
            consent ? t("addressCard.replaceTitle") : t("addressCard.apply")
          }
          message={
            <div className="flex flex-col gap-2">
              {asking === "apply" && (
                <p>
                  {t("addressCard.applyWarning", {
                    seconds: window_s ?? state.data.default_window_s,
                  })}
                </p>
              )}
              {consent && <p>{t("addressCard.replaceWarning")}</p>}
            </div>
          }
        />
      </CardContent>
    </Card>
  );
}
