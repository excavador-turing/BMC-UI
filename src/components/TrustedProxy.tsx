import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import ConfirmationModal from "@/components/ConfirmationModal";
import TextField from "@/components/TextField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAccessQuery } from "@/lib/api/get";
import {
  useRemoveClientCaMutation,
  useSetClientCaMutation,
} from "@/lib/api/set";

/**
 * The client CA a proxy must present to name an operator on this board's
 * behalf -- the fleet gateway's trust anchor.
 *
 * It lives with the certificates, not the password: it is a certificate the
 * board accepts, where the one above it is the certificate the board
 * presents, and those two are the halves people confuse. It used to sit
 * under the password form, with which it has nothing to do.
 *
 * Behind "Advanced", because it only matters to a board the fleet reaches;
 * on a board used on its own it was a PEM box and a header field for a
 * feature nobody there uses. The trigger says when a CA is stored, so a
 * closed section never hides that something may name operators here.
 */
export default function TrustedProxy() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const access = useAccessQuery();
  const setClientCa = useSetClientCaMutation();
  const removeClientCa = useRemoveClientCaMutation();

  const [pem, setPem] = useState("");
  const [header, setHeader] = useState("");
  const [removing, setRemoving] = useState(false);

  // A board on an older daemon has no such endpoint; there is nothing to
  // show rather than something broken.
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
    <>
      <Collapsible>
        <CollapsibleTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="group -ml-2 self-start text-muted-foreground"
            />
          }
        >
          <ChevronRight
            data-icon="inline-start"
            className="transition-transform group-data-panel-open:rotate-90"
          />
          {t("access.trustedProxy")}
          {state.client_ca !== null && (
            <Badge variant="secondary" className="ml-1">
              {t("access.trustedProxyActive")}
            </Badge>
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          {state.client_ca === null ? (
            <div className="mb-3 text-sm">{t("access.noTrustAnchor")}</div>
          ) : (
            <div className="mb-3 text-sm">
              <div>{state.client_ca.subject}</div>
              <div className="text-muted-foreground">
                {t("access.caExpires", { date: state.client_ca.not_after })}
              </div>
              {/* The fingerprint is the point of showing any of this: it is
                what an operator compares against the certificate their proxy
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
            about the same thing. */}
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
            // Showing the reason beats showing a control that is refused on
            // press.
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
                    // The daemon refuses this from an operator authenticated
                    // BY the CA -- the request would end its own session
                    // through the proxy it is asking through. Disabled here
                    // with the reason, rather than sent to be refused.
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
        </CollapsibleContent>
      </Collapsible>

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
    </>
  );
}
