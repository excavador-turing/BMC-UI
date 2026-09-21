import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import ConfirmationModal from "@/components/ConfirmationModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  type AddressDocument,
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
  const [confirming, setConfirming] = useState(false);
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
  useEffect(() => {
    if (!pending) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [pending]);

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
    windowOk &&
    !apply.isPending;

  const send = (how: "apply" | "try") => {
    if (!proposed) return;
    const body: Record<string, unknown> =
      window_s === null ? { ...proposed } : { ...proposed, window_s };
    apply.mutate(body, {
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
          description: e.message,
          variant: "destructive",
        }),
    });
  };

  const set = (patch: Partial<Draft>) => setEdited({ ...draft, ...patch });

  return (
    <div className="mt-8">
      <div className="mb-2 text-lg font-bold">{t("addressCard.title")}</div>

      {/* What the bridge has right now, before any form: on a DHCP board this
          is the lease, and it is the one line a person came to read. */}
      <p className="mb-4 text-sm">
        <span className="opacity-60">{t("addressCard.now")}</span>{" "}
        <span className="font-mono">
          {live.address ?? t("addressCard.noAddress")}
        </span>
        {live.gateway && (
          <>
            {" "}
            <span className="opacity-60">{t("addressCard.via")}</span>{" "}
            <span className="font-mono">{live.gateway}</span>
          </>
        )}
        {live.dns.length > 0 && (
          <>
            {" "}
            <span className="opacity-60">{t("addressCard.dnsWord")}</span>{" "}
            <span className="font-mono">{live.dns.join(" ")}</span>
          </>
        )}{" "}
        <span className="opacity-60">
          (
          {live.mode === "dhcp"
            ? t("addressCard.leased")
            : t("addressCard.fixed")}
          )
        </span>
      </p>

      {pending && (
        <div className="mb-4 rounded-md border border-amber-500 p-3 text-sm">
          <div className="font-semibold text-amber-700 dark:text-amber-500">
            {t("addressCard.pendingTitle", {
              address: words(pending.document, t),
            })}
          </div>
          <div className="mt-1">
            {remaining === null
              ? t("addressCard.pendingNoClock")
              : t("addressCard.countdown", { seconds: remaining })}
          </div>
          {tried && (
            <div className="mt-1 opacity-80">{t("addressCard.tryingNow")}</div>
          )}
          <div className="mt-3 flex gap-4">
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
                      description: e.message,
                      variant: "destructive",
                    }),
                })
              }
            >
              {t("addressCard.confirm")}
            </Button>
            <Button
              type="button"
              variant="bw"
              disabled={revert.isPending}
              onClick={() => revert.mutate()}
            >
              {t("addressCard.revertNow")}
            </Button>
          </div>
          {/* The one thing this card must say: a confirmation only counts
              from the new address. This page, reached at the old one, is
              about to stop answering. */}
          <div className="mt-2 text-xs opacity-80">
            {t("addressCard.confirmFromThere")}
          </div>
        </div>
      )}

      {!pending && state.data.last_revert?.reason === "not_confirmed" && (
        <div className="mb-4 text-sm text-amber-700 dark:text-amber-500">
          {t("addressCard.wasReverted", {
            at: new Date(
              epochMillis(state.data.last_revert.at) ?? 0
            ).toLocaleTimeString(),
          })}
        </div>
      )}
      {!pending && state.data.last_revert?.reason === "apply_failed" && (
        <div className="mb-4 text-sm text-red-700 dark:text-red-400">
          {t("addressCard.applyFailedRevert")}
        </div>
      )}

      {state.data.file === "unreadable" && (
        <p className="mb-3 text-sm text-amber-700 dark:text-amber-500">
          {t("addressCard.fileUnreadable")}
        </p>
      )}
      {state.data.file === "hand_edited" &&
        state.data.configured?.mode === "static" && (
          <p className="mb-3 text-sm opacity-70">
            {t("addressCard.fileHandEdited")}
          </p>
        )}

      <div
        role="radiogroup"
        aria-label={t("addressCard.mode")}
        className="mb-3 flex gap-1"
      >
        {(["dhcp", "static"] as const).map((mode) => (
          <Button
            key={mode}
            type="button"
            role="radio"
            aria-checked={draft.mode === mode}
            size="sm"
            variant={draft.mode === mode ? "turing-green" : "bw"}
            disabled={pending !== null}
            onClick={() =>
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
              )
            }
          >
            {mode === "dhcp" ? t("addressCard.dhcp") : t("addressCard.static")}
          </Button>
        ))}
      </div>

      {draft.mode === "static" && (
        <div className="mb-3 grid max-w-2xl gap-3 sm:grid-cols-2">
          <Input
            name="address"
            label={t("addressCard.addressLabel")}
            value={draft.cidr}
            spellCheck={false}
            placeholder="192.168.1.20/24"
            disabled={pending !== null}
            onChange={(e) => set({ cidr: e.target.value })}
          />
          <Input
            name="gateway"
            label={t("addressCard.gatewayLabel")}
            value={draft.gateway}
            spellCheck={false}
            placeholder="192.168.1.1"
            disabled={pending !== null}
            onChange={(e) => set({ gateway: e.target.value })}
          />
          <Input
            name="dns"
            label={t("addressCard.dnsLabel")}
            value={draft.dns}
            spellCheck={false}
            placeholder="192.168.1.1, 1.1.1.1"
            disabled={pending !== null}
            onChange={(e) => set({ dns: e.target.value })}
          />
          <Input
            name="search"
            label={t("addressCard.searchLabel")}
            value={draft.search}
            spellCheck={false}
            placeholder="home.lan"
            disabled={pending !== null}
            onChange={(e) => set({ search: e.target.value })}
          />
        </div>
      )}

      {/* The board's verdict, as the board words it. */}
      {edits && proposed === null && draft.mode === "static" && (
        <div className="mb-2 text-sm opacity-60">
          {t("addressCard.incomplete")}
        </div>
      )}
      {verdict.data?.refusal && (
        <div className="mb-2 text-sm font-semibold text-red-700 dark:text-red-400">
          {verdict.data.refusal.reason}
        </div>
      )}
      {verdict.data?.refusal == null &&
        verdict.data?.warnings.map((w) => (
          <div
            key={w.reason}
            className="mb-2 text-sm text-amber-700 dark:text-amber-500"
          >
            {w.reason}
          </div>
        ))}
      {verdict.isError && (
        <div className="mb-2 text-sm opacity-80">
          {t("addressCard.cannotCheck")}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={!canApply}
          onClick={() => setConfirming(true)}
        >
          {t("addressCard.apply")}
        </Button>
        <Button
          type="button"
          variant="bw"
          disabled={!canApply}
          onClick={() => send("try")}
        >
          {t("addressCard.tryIt")}
        </Button>
        {limits && (
          <label className="flex items-center gap-2 text-sm">
            {t("addressCard.windowLabel")}
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
              {t("addressCard.windowRange", {
                min: limits.window_min_s,
                max: limits.window_max_s,
              })}
            </span>
          </label>
        )}
        {edits && (
          <button
            type="button"
            className="text-sm underline opacity-80"
            onClick={() => setEdited(null)}
          >
            {t("addressCard.discard")}
          </button>
        )}
      </div>
      <p className="mt-2 text-sm opacity-60">
        {edits
          ? t("addressCard.tryItNote")
          : t("addressCard.unchanged", { address: words(running!, t) })}
      </p>

      <ConfirmationModal
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          send("apply");
        }}
        title={t("addressCard.apply")}
        message={t("addressCard.applyWarning", {
          seconds: window_s ?? state.data.default_window_s,
        })}
      />
    </div>
  );
}
