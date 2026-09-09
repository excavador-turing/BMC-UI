import {
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  ShieldQuestion,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  type FirmwareCandidate,
  type FirmwareSourceCatalog,
  type FirmwareTrust,
  useFirmwareAvailableQuery,
} from "@/lib/api/get";
import { useInstallFirmwareMutation } from "@/lib/api/set";
import { cn } from "@/lib/utils";

/**
 * What each configured source is offering, and a way to install one.
 *
 * Three things here are deliberate and easy to get wrong:
 *
 * A source that FAILED renders its error. An empty list with no error means
 * the source genuinely has nothing; an empty list with one means it could not
 * be read. Collapsing those into "up to date" is how a board with no route to
 * GitHub quietly claims to be current.
 *
 * Older versions are hidden until asked for. This board's SD card has carried
 * a dozen images from deleted releases; offering them beside real upgrades is
 * how somebody installs one by accident.
 *
 * Trust is shown per candidate, because a publisher-verified checksum and a
 * file of unknown provenance are different acts and the page is the only place
 * that difference is visible.
 */
function TrustBadge({ trust }: { trust: FirmwareTrust }) {
  const { t } = useTranslation();
  if (trust === "verified") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
        <ShieldCheck className="size-3.5" />
        {t("firmwareUpgrade.trustVerified")}
      </span>
    );
  }
  if (trust === "tls") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
        <ShieldQuestion className="size-3.5" />
        {t("firmwareUpgrade.trustTls")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
      <ShieldQuestion className="size-3.5" />
      {t("firmwareUpgrade.trustUnverified")}
    </span>
  );
}

function CandidateRow({
  candidate,
  onInstall,
  busy,
}: {
  candidate: FirmwareCandidate;
  onInstall: (c: FirmwareCandidate) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between gap-4 border-b py-2 last:border-b-0">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold">{candidate.version}</span>
          {candidate.relation === "current" && (
            <span className="text-xs opacity-60">
              {t("firmwareUpgrade.relationCurrent")}
            </span>
          )}
          {candidate.relation === "newer" && (
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-500">
              {t("firmwareUpgrade.relationNewer")}
            </span>
          )}
          {candidate.relation === "older" && (
            <span className="text-xs opacity-60">
              {t("firmwareUpgrade.relationOlder")}
            </span>
          )}
          {candidate.relation === "unknown" && (
            <span className="text-xs opacity-60">
              {t("firmwareUpgrade.relationUnknown")}
            </span>
          )}
          {candidate.prerelease && (
            <span className="text-xs opacity-60">
              {t("firmwareUpgrade.prerelease")}
            </span>
          )}
        </div>
        <TrustBadge trust={candidate.trust} />
      </div>
      {/* A parked image can be installed now: the daemon takes it through the
          transfer endpoint rather than the updater, which is why this used to
          be refused. Only the running version is still not installable, and
          that is because there is nothing to do. */}
      <Button
        variant="bw"
        size="sm"
        disabled={busy || candidate.relation === "current"}
        onClick={() => onInstall(candidate)}
      >
        {t("firmwareUpgrade.install")}
      </Button>
    </div>
  );
}

export default function FirmwareCandidates() {
  const { t } = useTranslation();
  const [showOlder, setShowOlder] = useState(false);
  const [confirming, setConfirming] = useState<{
    source: FirmwareSourceCatalog;
    candidate: FirmwareCandidate;
  } | null>(null);

  const catalog = useFirmwareAvailableQuery();
  const install = useInstallFirmwareMutation();
  const [checking, setChecking] = useState(false);

  /**
   * The daemon answers a `refresh` at once and re-polls the sources behind
   * itself, so the new answers arrive after this request has already
   * returned. Poll for them while it says it is still working, and stop when
   * it stops -- rather than leaving the page showing the previous list with
   * no sign that anything is happening.
   */
  useEffect(() => {
    if (!catalog.data?.refreshing) return;
    const timer = setInterval(() => void catalog.refetch(), 2000);
    return () => clearInterval(timer);
  }, [catalog.data?.refreshing, catalog]);

  const checkNow = async () => {
    setChecking(true);
    try {
      await catalog.checkNow();
    } finally {
      setChecking(false);
    }
  };

  const doInstall = async () => {
    if (!confirming) return;
    const { source, candidate } = confirming;
    setConfirming(null);
    await install.mutateAsync({
      source: source.id,
      version: candidate.version,
      // Anything not strictly newer needs the updater's explicit consent.
      allowDowngrade: candidate.relation !== "newer",
      // The catalogue reports the path for a local candidate; that is what
      // decides which endpoint this goes to.
      localFile:
        source.kind === "local" ? (candidate.file ?? undefined) : undefined,
    });
    await catalog.refetch();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">
          {t("firmwareUpgrade.availableTitle")}
        </h2>
        {/* The spinner belongs on this control, not over the page: the list
            below stays readable and stays scrollable while the sources are
            re-polled. `refreshing` is the daemon still working after it
            answered; `checking` is our own request in flight. */}
        <Button
          variant="bw"
          size="sm"
          disabled={checking || catalog.data?.refreshing}
          onClick={() => void checkNow()}
        >
          <RefreshCw
            className={cn(
              "mr-2 size-4",
              (checking || catalog.data?.refreshing) && "animate-spin"
            )}
          />
          {t("firmwareUpgrade.checkNow")}
        </Button>
      </div>

      {/* When it last looked. Without this the page asserts "current" from
          data up to half an hour old, which is a claim about the present
          tense made from the past. */}
      {catalog.data && (
        <p className="text-sm opacity-60">
          {catalog.data.refreshing
            ? t("firmwareUpgrade.checking")
            : t("firmwareUpgrade.checkedAt", {
                at: catalog.data.checked_at,
              })}{" "}
          · {t("firmwareUpgrade.runningIs", { version: catalog.data.running })}
        </p>
      )}

      {catalog.isError && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {t("firmwareUpgrade.availableError")}
        </p>
      )}

      {catalog.data?.sources.map((source) => {
        const shown = source.candidates.filter(
          (c) => showOlder || c.relation === "newer" || c.relation === "current"
        );
        const hidden = source.candidates.length - shown.length;
        return (
          <div key={source.id} className="rounded-md border p-4">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="font-semibold">{source.label}</span>
              <span className="font-mono text-xs opacity-60">
                {source.location}
              </span>
            </div>

            {/* An error is never rendered as "nothing new". */}
            {source.error && (
              <p className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                {t("firmwareUpgrade.sourceUnreadable", {
                  reason: source.error,
                })}
              </p>
            )}

            {!source.error && source.candidates.length === 0 && (
              <p className="text-sm opacity-60">
                {t("firmwareUpgrade.sourceEmpty")}
              </p>
            )}

            {shown.map((c) => (
              <CandidateRow
                key={`${source.id}-${c.version}`}
                candidate={c}
                busy={install.isPending}
                onInstall={(candidate) => setConfirming({ source, candidate })}
              />
            ))}

            {hidden > 0 && !showOlder && (
              <button
                type="button"
                className="mt-2 text-sm underline opacity-70"
                onClick={() => setShowOlder(true)}
              >
                {t("firmwareUpgrade.showOlder", { count: hidden })}
              </button>
            )}
          </div>
        );
      })}

      {confirming && (
        <div className="flex flex-col gap-2 rounded-md border border-amber-500 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {/* The confirmation NAMES the version. The old dialog said only
              "a reboot is required", which is true of every upgrade and
              identifies none of them. */}
          <p className="font-semibold">
            {t("firmwareUpgrade.confirmTitle", {
              version: confirming.candidate.version,
            })}
          </p>
          <p className="text-sm">
            {confirming.candidate.relation === "older"
              ? t("firmwareUpgrade.confirmDowngrade")
              : confirming.candidate.relation === "unknown"
                ? t("firmwareUpgrade.confirmUnknown")
                : t("firmwareUpgrade.confirmUpgrade")}
          </p>
          {confirming.candidate.trust !== "verified" && (
            <p className="text-sm font-semibold">
              {t("firmwareUpgrade.confirmUnverified")}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="destructive"
              disabled={install.isPending}
              onClick={() => void doInstall()}
            >
              {t("firmwareUpgrade.install")}
            </Button>
            <Button variant="bw" onClick={() => setConfirming(null)}>
              {t("ui.cancel")}
            </Button>
          </div>
        </div>
      )}

      {install.isError && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {t("firmwareUpgrade.installFailed")}
        </p>
      )}
      {install.isSuccess && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          {t("firmwareUpgrade.installStaged")}
        </p>
      )}
    </div>
  );
}
