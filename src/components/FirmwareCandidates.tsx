import {
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  ShieldQuestion,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import ConfirmationModal from "@/components/ConfirmationModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
 * Each source shows its NEWEST ONE, whatever its relation to the running
 * version; the rest are behind "show all". The question this page exists to
 * answer is *is there something newer than what I am running, and where
 * from*, and twelve rows is not the answer to that -- it is the catalogue.
 * Four sources at three rows each made the tab 2508 px, most of it versions
 * nobody was going to install. Nothing on offer changed; only how much of it
 * is open at once.
 *
 * Trust is shown per candidate, because a publisher-verified checksum and a
 * file of unknown provenance are different acts and the page is the only place
 * that difference is visible.
 */
function TrustBadge({ trust }: { trust: FirmwareTrust }) {
  const { t } = useTranslation();
  if (trust === "verified") {
    return (
      <Badge variant="secondary">
        <ShieldCheck data-icon="inline-start" />
        {t("firmwareUpgrade.trustVerified")}
      </Badge>
    );
  }
  if (trust === "tls") {
    return (
      <Badge variant="warning">
        <ShieldQuestion data-icon="inline-start" />
        {t("firmwareUpgrade.trustTls")}
      </Badge>
    );
  }
  return (
    <Badge variant="warning">
      <ShieldQuestion data-icon="inline-start" />
      {t("firmwareUpgrade.trustUnverified")}
    </Badge>
  );
}

/**
 * Where a candidate's release notes live, when there is such a page.
 *
 * A GitHub source's `location` is `owner/repo` and a candidate's `version` is
 * the release tag, so the page is exactly `releases/tag/<version>` -- a
 * documented, stable URL shape, not a guess. An HTTP mirror is a directory of
 * files with nothing to read, and a file on the SD card has no page at all,
 * so those get no link rather than a link to nowhere.
 */
function releaseNotesUrl(
  source: FirmwareSourceCatalog,
  candidate: FirmwareCandidate
): string | null {
  if (source.kind !== "github") return null;
  return `https://github.com/${source.location}/releases/tag/${encodeURIComponent(candidate.version)}`;
}

/**
 * How long an install takes, for the status line below, measured rather than
 * guessed: `firmware_install` on board B, v2.37.0 from GitHub into the spare
 * slot -- download (38.5 MB at 7 MB/s), sum, write, arm -- 26 s wall on
 * 2026-09-23. A hint, not a deadline: a slow link takes longer and the line
 * says so once it passes.
 */
export const EXPECTED_INSTALL_SECONDS = 26;

function CandidateRow({
  source,
  candidate,
  onInstall,
  busy,
  installing,
}: {
  source: FirmwareSourceCatalog;
  candidate: FirmwareCandidate;
  onInstall: (c: FirmwareCandidate) => void;
  busy: boolean;
  /** This row's candidate is the one being installed right now. */
  installing: boolean;
}) {
  const { t } = useTranslation();
  const notes = releaseNotesUrl(source, candidate);

  return (
    <div className="flex items-center justify-between gap-4 border-b py-2 last:border-b-0">
      <div className="flex flex-col items-start gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono font-medium">{candidate.version}</span>
          {candidate.relation === "current" && (
            <Badge variant="outline">
              {t("firmwareUpgrade.relationCurrent")}
            </Badge>
          )}
          {candidate.relation === "newer" && (
            <Badge>{t("firmwareUpgrade.relationNewer")}</Badge>
          )}
          {candidate.relation === "older" && (
            <span className="text-xs text-muted-foreground">
              {t("firmwareUpgrade.relationOlder")}
            </span>
          )}
          {candidate.relation === "unknown" && (
            <span className="text-xs text-muted-foreground">
              {t("firmwareUpgrade.relationUnknown")}
            </span>
          )}
          {candidate.prerelease && (
            <span className="text-xs text-muted-foreground">
              {t("firmwareUpgrade.prerelease")}
            </span>
          )}
        </div>
        <TrustBadge trust={candidate.trust} />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {/* What changed, before deciding to install it. Only where a page
            exists: a mirror directory and an SD card have nothing to read. */}
        {notes && (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <a href={notes} target="_blank" rel="noreferrer noopener" />
            }
          >
            <ExternalLink data-icon="inline-start" />
            {t("firmwareUpgrade.releaseNotes")}
          </Button>
        )}
        {/* A parked image can be installed now: the daemon takes it through
            the transfer endpoint rather than the updater, which is why this
            used to be refused. Only the running version is still not
            installable, and that is because there is nothing to do. */}
        <Button
          variant="outline"
          size="sm"
          disabled={busy || candidate.relation === "current"}
          onClick={() => onInstall(candidate)}
        >
          {installing
            ? t("firmwareUpgrade.installing")
            : t("firmwareUpgrade.install")}
        </Button>
      </div>
    </div>
  );
}

/** How many of a source's newest candidates are shown before "show all". */
const VISIBLE_PER_SOURCE = 1;

export default function FirmwareCandidates() {
  const { t } = useTranslation();
  // Per source, not per page: opening the long list on the mirror should not
  // also unfold the fork's three releases.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const [confirming, setConfirming] = useState<{
    source: FirmwareSourceCatalog;
    candidate: FirmwareCandidate;
  } | null>(null);

  const catalog = useFirmwareAvailableQuery();
  const install = useInstallFirmwareMutation();
  const [checking, setChecking] = useState(false);

  /**
   * The daemon does the whole install inside the one request -- download,
   * sum, write to the spare slot, arm the next boot -- and answers when it is
   * done. Until this counter existed the page showed a greyed button for the
   * whole of that, and a reader wondered whether to refresh (Discord,
   * 2026-09-22). The reboot banner already says "about N s, now at M"; this
   * is the same shape for the same reason.
   */
  // Derived from the mutation's own submittedAt rather than counted, so the
  // effect sets no state itself: the interval only moves the clock.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!install.isPending) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [install.isPending]);
  const installElapsed = install.isPending
    ? Math.max(0, Math.floor((now - install.submittedAt) / 1000))
    : 0;

  /**
   * The daemon answers a `refresh` at once and re-polls the sources behind
   * itself, so the new answers arrive after this request has already
   * returned. Poll for them while it says it is still working, and stop when
   * it stops -- rather than leaving the page showing the previous list with
   * no sign that anything is happening.
   */
  useEffect(() => {
    if (!catalog.data?.refreshing) return;
    // Bounded, and that bound is not a nicety.
    //
    // A daemon that dies mid-fan-out, or any bug that leaves its `refreshing`
    // flag set, used to leave this page polling a 116 MB board every two
    // seconds for as long as a tab stayed open -- which is how a browser left
    // on this page overnight becomes a load generator. Sixty polls is two
    // minutes, longer than any healthy refresh (the slowest measured was 16
    // seconds), after which the page stops asking and shows what it has.
    let polls = 0;
    const timer = setInterval(() => {
      if (++polls > 60) {
        clearInterval(timer);
        return;
      }
      void catalog.refetch();
    }, 2000);
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
    <Card>
      <CardHeader>
        <CardTitle>{t("firmwareUpgrade.availableTitle")}</CardTitle>
        {/* When it last looked. Without this the page asserts "current" from
          data up to half an hour old, which is a claim about the present
          tense made from the past. */}
        {catalog.data && (
          <CardDescription>
            {catalog.data.refreshing
              ? t("firmwareUpgrade.checking")
              : t("firmwareUpgrade.checkedAt", {
                  at: catalog.data.checked_at,
                })}{" "}
            ·{" "}
            {t("firmwareUpgrade.runningIs", { version: catalog.data.running })}
          </CardDescription>
        )}
        <CardAction>
          {/* The spinner belongs on this control, not over the page: the list
            below stays readable and stays scrollable while the sources are
            re-polled. `refreshing` is the daemon still working after it
            answered; `checking` is our own request in flight. */}
          <Button
            variant="outline"
            size="sm"
            disabled={checking || catalog.data?.refreshing}
            onClick={() => void checkNow()}
          >
            <RefreshCw
              data-icon="inline-start"
              className={cn(
                (checking || catalog.data?.refreshing) && "animate-spin"
              )}
            />
            {t("firmwareUpgrade.checkNow")}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {catalog.isError && (
          <p className="text-sm text-destructive">
            {t("firmwareUpgrade.availableError")}
          </p>
        )}

        {catalog.data?.sources.map((source) => {
          // The newest, always -- not "the newest that is newer than what is
          // running". Filtering by relation left a card with nothing in it but
          // a "show 3 older" link the moment a board ran something no source
          // offered yet, which is exactly the state right after a release is
          // cut and before it is published. The relation badge on the row says
          // what it is; hiding the row said nothing.
          const isOpen = expanded.has(source.id);
          const shown = isOpen
            ? source.candidates
            : source.candidates.slice(0, VISIBLE_PER_SOURCE);
          const hidden = source.candidates.length - shown.length;
          return (
            <div key={source.id} className="rounded-lg border p-4">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <span className="font-medium">{source.label}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {source.location}
                </span>
              </div>

              {/* An error is never rendered as "nothing new". */}
              {source.error && (
                <p className="flex items-start gap-2 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  {t("firmwareUpgrade.sourceUnreadable", {
                    reason: source.error,
                  })}
                </p>
              )}

              {!source.error && source.candidates.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t("firmwareUpgrade.sourceEmpty")}
                </p>
              )}

              {shown.map((c) => (
                <CandidateRow
                  key={`${source.id}-${c.version}`}
                  source={source}
                  candidate={c}
                  busy={install.isPending}
                  installing={
                    install.isPending &&
                    install.variables?.source === source.id &&
                    install.variables?.version === c.version
                  }
                  onInstall={(candidate) =>
                    setConfirming({ source, candidate })
                  }
                />
              ))}

              {(hidden > 0 || isOpen) && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="mt-2 px-0 text-muted-foreground"
                  onClick={() => toggle(source.id)}
                >
                  {isOpen
                    ? t("firmwareUpgrade.showFewer")
                    : t("firmwareUpgrade.showAll", {
                        count: source.candidates.length,
                      })}
                </Button>
              )}
            </div>
          );
        })}

        {/* A MODAL, not a panel below the list.

          It used to render inline, after every candidate. With a long
          catalogue -- and a board with several sources has one -- pressing
          Install scrolled the confirmation off the bottom of the window, so
          the button appeared to do nothing and the operator pressed it again.
          The same modal the reboot and node-power confirmations use puts the
          question where the answer is expected, and its drawer form handles
          the phone case the inline panel was worst on. */}
        <ConfirmationModal
          isOpen={confirming !== null}
          onClose={() => {
            setConfirming(null);
          }}
          onConfirm={() => void doInstall()}
          title={
            confirming
              ? t("firmwareUpgrade.confirmTitle", {
                  version: confirming.candidate.version,
                })
              : ""
          }
          message={
            confirming ? (
              <div className="flex flex-col gap-2">
                <p>
                  {confirming.candidate.relation === "older"
                    ? t("firmwareUpgrade.confirmDowngrade")
                    : confirming.candidate.relation === "unknown"
                      ? t("firmwareUpgrade.confirmUnknown")
                      : t("firmwareUpgrade.confirmUpgrade")}
                </p>
                {confirming.candidate.trust !== "verified" && (
                  <p className="font-medium text-warning">
                    {t("firmwareUpgrade.confirmUnverified")}
                  </p>
                )}
              </div>
            ) : (
              ""
            )
          }
        />

        {install.isPending && (
          <p role="status" aria-live="polite" className="text-sm text-warning">
            {installElapsed > EXPECTED_INSTALL_SECONDS
              ? t("firmwareUpgrade.installingOverdue", {
                  version: install.variables?.version,
                  elapsed: installElapsed,
                })
              : t("firmwareUpgrade.installingNow", {
                  version: install.variables?.version,
                  expected: EXPECTED_INSTALL_SECONDS,
                  elapsed: installElapsed,
                })}
          </p>
        )}
        {install.isError && (
          <p className="text-sm text-destructive">
            {t("firmwareUpgrade.installFailed")}
          </p>
        )}
        {install.isSuccess && (
          <p className="text-sm text-warning">
            {t("firmwareUpgrade.installStaged")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
