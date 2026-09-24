import { useState } from "react";
import { useTranslation } from "react-i18next";

import ConfirmationModal from "@/components/ConfirmationModal";
import PasswordForm from "@/components/PasswordForm";
import TextField from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAccessQuery } from "@/lib/api/get";
import {
  useRemoveClientCaMutation,
  useSetClientCaMutation,
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
  const setClientCa = useSetClientCaMutation();
  const removeClientCa = useRemoveClientCaMutation();

  const [pem, setPem] = useState("");
  const [header, setHeader] = useState("");
  const [removing, setRemoving] = useState(false);

  // A board on an older daemon has no such endpoint. A card that cannot work
  // is not shown as a card that is broken.
  if (access.isError || !access.data) return null;

  const state = access.data;
  const viaGateway = state.actor.scheme === "mtls";
  const pinned = state.client_ca_pinned_in_config;

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
    <Card>
      <CardHeader>
        <CardTitle>{t("access.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="text-sm">
          {t("access.youAre", {
            name: state.actor.name,
            scheme: state.actor.scheme,
          })}
          {viaGateway && (
            <span className="ml-1 text-muted-foreground">
              {t("access.viaGatewayNote")}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="font-medium">
            {t("access.passwordFor", { account: state.local_account })}
          </div>
          {/* The daemon requires the current password from everyone, including an
            operator the gateway vouched for, so the field is never hidden. */}
          <PasswordForm account={state.local_account} />
        </div>

        <Separator />

        <div>
          <div className="mb-2 font-medium">{t("access.trustedProxy")}</div>

          {state.client_ca === null ? (
            <div className="mb-3 text-sm">{t("access.noTrustAnchor")}</div>
          ) : (
            <div className="mb-3 text-sm">
              <div>{state.client_ca.subject}</div>
              <div className="text-muted-foreground">
                {t("access.caExpires", { date: state.client_ca.not_after })}
              </div>
              {/* The fingerprint is the point of showing any of this: it is what
                an operator compares against the certificate their proxy
                presents, and the only field that distinguishes two CAs with
                the same name. */}
              <div className="font-mono text-xs break-all text-muted-foreground">
                {state.client_ca.fingerprint}
              </div>
              {state.client_ca.count > 1 && (
                <div className="text-muted-foreground">
                  {t("access.caBundle", { count: state.client_ca.count })}
                </div>
              )}
            </div>
          )}

          {/* One paragraph with the next, not a gap between them: on a board
            whose CA is pinned in config.yaml these are two short sentences
            about the same thing, and the gap was the last 10 px keeping this
            tab scrolling. */}
          <div
            className={`text-sm text-muted-foreground ${pinned ? "" : "mb-3"}`}
          >
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
              <Textarea
                className="min-h-32 font-mono text-xs"
                placeholder={t("access.pemPlaceholder")}
                value={pem}
                onChange={(e) => setPem(e.target.value)}
              />
              <TextField
                name="identity-header"
                label={t("access.identityHeaderPlaceholder", {
                  name: state.identity_header.name,
                })}
                spellCheck={false}
                autoCapitalize="none"
                value={header}
                onChange={(e) => setHeader(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
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
                <div className="text-sm text-muted-foreground">
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
      </CardContent>
    </Card>
  );
}
