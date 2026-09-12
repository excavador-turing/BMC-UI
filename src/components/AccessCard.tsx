import { useState } from "react";
import { useTranslation } from "react-i18next";

import ConfirmationModal from "@/components/ConfirmationModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAccessQuery } from "@/lib/api/get";
import {
  useRemoveClientCaMutation,
  useSetClientCaMutation,
  useSetPasswordMutation,
} from "@/lib/api/set";

/**
 * Who may reach this board.
 *
 * Both halves of this used to be filesystem-only and arrive over SSH: the
 * password through `passwd` on a console, the trust anchor through a script
 * in another repository. The interface that demands a password on every login
 * could not change it, and nothing could answer "who can get in" without
 * logging in to look.
 *
 * WHAT THE CARD SHOWS FIRST is how YOU got here. An operator arriving through
 * the fleet is not holding this board's password and may not know there is
 * one; an operator on the board's own interface is. Saying which, before
 * offering either control, is what stops the next two sections being read as
 * the wrong thing.
 */
export default function AccessCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const access = useAccessQuery();
  const setPassword = useSetPasswordMutation();
  const setClientCa = useSetClientCaMutation();
  const removeClientCa = useRemoveClientCaMutation();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [pem, setPem] = useState("");
  const [header, setHeader] = useState("");
  const [removing, setRemoving] = useState(false);

  // A board on an older daemon has no such endpoint. A card that cannot work
  // is not shown as a card that is broken.
  if (access.isError || !access.data) return null;

  const state = access.data;
  const viaGateway = state.actor.scheme === "mtls";
  const pinned = state.client_ca_pinned_in_config;

  // The daemon's rule, restated here so the button is disabled rather than
  // pressed and refused. It is twelve CHARACTERS: a passphrase is not shorter
  // for being written in an alphabet with wider codepoints, so count the way
  // the daemon counts.
  const longEnough = [...next].length >= 12;
  const matches = next !== "" && next === again;
  const canChange = current !== "" && longEnough && matches && next !== current;

  const clearPasswordFields = () => {
    setCurrent("");
    setNext("");
    setAgain("");
  };

  const applyPassword = () => {
    setPassword.mutate(
      {
        username: state.local_account,
        current_password: current,
        new_password: next,
      },
      {
        onSuccess: () => {
          clearPasswordFields();
          toast({ title: t("access.passwordChanged") });
        },
        onError: (e: Error) =>
          toast({
            title: t("access.passwordFailed"),
            description: e.message,
            variant: "destructive",
          }),
      }
    );
  };

  const applyCa = () => {
    setClientCa.mutate(
      {
        pem,
        ...(header.trim() === "" ? {} : { identity_header: header.trim() }),
      },
      {
        onSuccess: () => {
          setPem("");
          setHeader("");
          toast({
            title: t("access.caStored"),
            description: t("access.reloadRequired"),
          });
        },
        onError: (e: Error) =>
          toast({
            title: t("access.caFailed"),
            description: e.message,
            variant: "destructive",
          }),
      }
    );
  };

  return (
    <div>
      <div className="mb-6 text-lg font-bold">{t("access.title")}</div>

      <div className="mb-6 text-sm">
        {t("access.youAre", {
          name: state.actor.name,
          scheme: state.actor.scheme,
        })}
        {viaGateway && (
          <span className="ml-1 opacity-80">{t("access.viaGatewayNote")}</span>
        )}
      </div>

      <div className="mb-8">
        <div className="mb-2 font-semibold">
          {t("access.passwordFor", { account: state.local_account })}
        </div>
        {/* The daemon requires the current password from everyone, including an
            operator the gateway vouched for, so the field is never hidden. */}
        <div className="flex max-w-md flex-col gap-2">
          <Input
            name="current-password"
            label={t("access.currentPassword")}
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
          <Input
            name="new-password"
            label={t("access.newPassword")}
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
          <Input
            name="repeat-password"
            label={t("access.repeatPassword")}
            type="password"
            autoComplete="new-password"
            value={again}
            onChange={(e) => setAgain(e.target.value)}
          />
          {/* One message at a time, and only once there is something to say
              about: a rule shown before the first keystroke reads as an
              error the operator has already made. */}
          {next !== "" && !longEnough && (
            <div className="text-sm opacity-80">{t("access.tooShort")}</div>
          )}
          {again !== "" && !matches && (
            <div className="text-sm opacity-80">{t("access.noMatch")}</div>
          )}
          <div>
            <Button
              type="button"
              disabled={!canChange || setPassword.isPending}
              onClick={applyPassword}
            >
              {t("access.changePassword")}
            </Button>
          </div>
          <div className="text-sm opacity-80">{t("access.sessionsNote")}</div>
        </div>
      </div>

      <div>
        <div className="mb-2 font-semibold">{t("access.trustedProxy")}</div>

        {state.client_ca === null ? (
          <div className="mb-3 text-sm">{t("access.noTrustAnchor")}</div>
        ) : (
          <div className="mb-3 text-sm">
            <div>{state.client_ca.subject}</div>
            <div className="opacity-80">
              {t("access.caExpires", { date: state.client_ca.not_after })}
            </div>
            {/* The fingerprint is the point of showing any of this: it is what
                an operator compares against the certificate their proxy
                presents, and the only field that distinguishes two CAs with
                the same name. */}
            <div className="font-mono text-xs break-all opacity-80">
              {state.client_ca.fingerprint}
            </div>
            {state.client_ca.count > 1 && (
              <div className="opacity-80">
                {t("access.caBundle", { count: state.client_ca.count })}
              </div>
            )}
          </div>
        )}

        <div className="mb-3 text-sm opacity-80">
          {t("access.identityHeader", {
            name: state.identity_header.name,
            source: state.identity_header.source,
          })}
        </div>

        {pinned ? (
          // config.yaml chose it, and the daemon will not rewrite that file.
          // Showing a disabled control with the reason beats showing one that
          // is refused on press.
          <div className="text-sm">{t("access.pinnedInConfig")}</div>
        ) : (
          <div className="flex max-w-2xl flex-col gap-2">
            <textarea
              className="min-h-32 rounded-md border bg-transparent p-2 font-mono text-xs"
              placeholder={t("access.pemPlaceholder")}
              value={pem}
              onChange={(e) => setPem(e.target.value)}
            />
            <Input
              name="identity-header"
              label={t("access.identityHeaderPlaceholder", {
                name: state.identity_header.name,
              })}
              spellCheck={false}
              autoCapitalize="none"
              value={header}
              onChange={(e) => setHeader(e.target.value)}
            />
            <div className="flex gap-4">
              <Button
                type="button"
                disabled={pem.trim() === "" || setClientCa.isPending}
                onClick={applyCa}
              >
                {t("access.storeCa")}
              </Button>
              {state.client_ca !== null && (
                <Button
                  type="button"
                  variant="destructive"
                  // The daemon refuses this from an operator authenticated BY
                  // the CA -- the request would end its own session through
                  // the proxy it is asking through. Disabled here with the
                  // reason, rather than sent to be refused.
                  disabled={viaGateway || removeClientCa.isPending}
                  onClick={() => setRemoving(true)}
                >
                  {t("access.removeCa")}
                </Button>
              )}
            </div>
            {viaGateway && state.client_ca !== null && (
              <div className="text-sm opacity-80">
                {t("access.cannotRemoveFromHere")}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={removing}
        onClose={() => setRemoving(false)}
        onConfirm={() => {
          setRemoving(false);
          removeClientCa.mutate(undefined, {
            onSuccess: () =>
              toast({
                title: t("access.caRemoved"),
                description: t("access.reloadRequired"),
              }),
            onError: (e: Error) =>
              toast({
                title: t("access.caFailed"),
                description: e.message,
                variant: "destructive",
              }),
          });
        }}
        title={t("access.removeCa")}
        message={t("access.removeCaConfirm")}
      />
    </div>
  );
}
