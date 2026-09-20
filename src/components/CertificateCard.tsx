import { useState } from "react";
import { useTranslation } from "react-i18next";

import ConfirmationModal from "@/components/ConfirmationModal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useTlsCertificateQuery } from "@/lib/api/get";
import {
  useInstallCertificateMutation,
  useResetCertificateMutation,
} from "@/lib/api/set";

/**
 * The certificate this board serves over HTTPS.
 *
 * Asked for twice in the Turing Pi Discord by people running their own CA.
 * They want a board a browser opens without a warning -- and a serial console
 * that works, because a click-through certificate exception does not extend
 * to the console's WebSocket, so on a board with a self-signed certificate
 * the console simply fails to connect and says nothing useful about why.
 *
 * WHAT THE CARD LEADS WITH is where the certificate came from, not what it
 * is. `self-signed` and `installed` look like a label; the difference is who
 * renews it. A board's own certificate is reissued 30 days before expiry and
 * needs nobody. An installed one is never touched by the board -- deliberately,
 * since replacing an operator's certificate with a self-signed one at boot
 * would turn a working deployment into a browser warning -- so its expiry is
 * a date somebody has to diarise.
 */
export default function CertificateCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const certificate = useTlsCertificateQuery();
  const install = useInstallCertificateMutation();
  const reset = useResetCertificateMutation();

  const [cert, setCert] = useState("");
  const [key, setKey] = useState("");
  const [resetting, setResetting] = useState(false);
  const [installing, setInstalling] = useState(false);

  // A board on an older daemon has no such endpoint. A card that cannot work
  // is not shown as a card that is broken.
  if (certificate.isError || !certificate.data) return null;

  const state = certificate.data;
  const installed = state.source === "installed";

  // The two mistakes worth catching before the round-trip. The daemon
  // validates properly and refuses before writing anything; this is about
  // which message you get. A combined file is the dangerous one: it is what
  // openssl writes when told to put both in one place, and sending it would
  // put the private key in the field the board treats as public.
  const certLooksRight = cert.includes("BEGIN CERTIFICATE");
  const certHoldsKey = cert.includes("PRIVATE KEY");
  const keyLooksRight = key.includes("PRIVATE KEY");
  const canInstall =
    certLooksRight && !certHoldsKey && keyLooksRight && !install.isPending;

  const applyCertificate = () => {
    install.mutate(
      { certificate: cert, private_key: key },
      {
        onSuccess: () => {
          setCert("");
          setKey("");
          toast({
            title: t("certificate.installed"),
            description: t("certificate.installedNote"),
          });
        },
        onError: (e: Error) =>
          toast({
            title: t("certificate.installFailed"),
            description: e.message,
            variant: "destructive",
          }),
      }
    );
  };

  return (
    <div>
      <div className="mb-6 text-lg font-bold">{t("certificate.title")}</div>

      <div className="mb-6 text-sm">
        <div>{state.subject}</div>
        <div className="opacity-80">
          {t("certificate.issuedBy", { issuer: state.issuer })}
        </div>
        <div className="opacity-80">
          {t("certificate.expires", { date: state.not_after })}
        </div>
        {state.key && (
          <div className="opacity-80">
            {t("certificate.key", { key: state.key })}
          </div>
        )}
        {/* The names are the reason a browser accepts or refuses the
            certificate, so they are shown rather than summarised. */}
        {state.names.length > 0 && (
          <div className="opacity-80">
            {t("certificate.names", { names: state.names.join(", ") })}
          </div>
        )}
        {/* The fingerprint is what an operator compares against what their
            browser shows, and the only field that tells two certificates with
            the same subject apart. */}
        <div className="font-mono text-xs break-all opacity-80">
          {state.fingerprint}
        </div>
      </div>

      <div className="mb-6 text-sm">
        {installed
          ? t("certificate.sourceInstalled")
          : t("certificate.sourceSelfSigned")}
      </div>

      {/* Behind a disclosure, because the two PEM boxes were 250 px of a card
          whose everyday job is answering "what certificate does this board
          serve, and when does it expire". Installing one is an occasional
          act; reading what is installed is not. The reset button stays out
          here with it, since it belongs to the same decision. */}
      <button
        type="button"
        className="text-sm underline opacity-80"
        onClick={() => setInstalling((open) => !open)}
      >
        {installing
          ? t("certificate.installHide")
          : t("certificate.installHeading")}
      </button>

      <div
        className={`mt-3 max-w-2xl flex-col gap-2 ${installing ? "flex" : "hidden"}`}
      >
        <div className="text-sm opacity-80">{t("certificate.installNote")}</div>

        <textarea
          className="min-h-32 rounded-md border bg-transparent p-2 font-mono text-xs"
          placeholder={t("certificate.certPlaceholder")}
          value={cert}
          onChange={(e) => setCert(e.target.value)}
        />
        <textarea
          className="min-h-32 rounded-md border bg-transparent p-2 font-mono text-xs"
          placeholder={t("certificate.keyPlaceholder")}
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />

        {/* One message at a time, and only once there is something to say
            about: a rule shown before the first keystroke reads as an error
            the operator has already made. */}
        {cert !== "" && !certLooksRight && (
          <div className="text-sm opacity-80">
            {t("certificate.notACertificate")}
          </div>
        )}
        {certHoldsKey && (
          <div className="text-sm font-semibold text-amber-700 dark:text-amber-500">
            {t("certificate.certHoldsKey")}
          </div>
        )}
        {key !== "" && !keyLooksRight && (
          <div className="text-sm opacity-80">{t("certificate.notAKey")}</div>
        )}

        <div className="flex gap-4">
          <Button
            type="button"
            disabled={!canInstall}
            onClick={applyCertificate}
          >
            {t("certificate.install")}
          </Button>
          {installed && (
            <Button
              type="button"
              variant="destructive"
              disabled={reset.isPending}
              onClick={() => setResetting(true)}
            >
              {t("certificate.reset")}
            </Button>
          )}
        </div>

        <div className="text-sm opacity-80">
          {t("certificate.noRestartNote")}
        </div>
      </div>

      <ConfirmationModal
        isOpen={resetting}
        onClose={() => setResetting(false)}
        onConfirm={() => {
          setResetting(false);
          reset.mutate(undefined, {
            onSuccess: () => toast({ title: t("certificate.reset") }),
            onError: (e: Error) =>
              toast({
                title: t("certificate.resetFailed"),
                description: e.message,
                variant: "destructive",
              }),
          });
        }}
        title={t("certificate.reset")}
        message={t("certificate.resetConfirm")}
      />
    </div>
  );
}
