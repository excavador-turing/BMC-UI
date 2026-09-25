import {
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Settings2,
  ShieldCheck,
  ShieldQuestion,
  Upload,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import ConfirmationModal from "@/components/ConfirmationModal";
import FirmwareSources from "@/components/FirmwareSources";
import FirmwareUploadDialog from "@/components/FirmwareUploadDialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
    <TableRow>
      <TableCell className="align-top whitespace-normal">
        <div className="flex flex-col items-start gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium tabular-nums">
              {candidate.version}
            </span>
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
            {/* No word for "unknown": on a board running a local build it
                was on every row and said nothing. The install confirmation
                still says the version may be older. */}
            {candidate.prerelease && (
              <span className="text-xs text-muted-foreground">
                {t("firmwareUpgrade.prerelease")}
              </span>
            )}
          </div>
          {/* On a phone the source and checksum columns fold in here, so
              the table never scrolls sideways. */}
          <div className="flex flex-col items-start gap-1 sm:hidden">
            <span className="text-xs text-muted-foreground">
              {source.label}
            </span>
            <TrustBadge trust={candidate.trust} />
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden align-top sm:table-cell">
        <span title={source.location}>{source.label}</span>
      </TableCell>
      <TableCell className="hidden align-top sm:table-cell">
        <TrustBadge trust={candidate.trust} />
      </TableCell>
      <TableCell className="align-top">
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
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
              <span className="max-sm:sr-only">
                {t("firmwareUpgrade.releaseNotes")}
              </span>
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
      </TableCell>
    </TableRow>
  );
}

/** How many of a source's newest candidates are shown before "show all". */
const VISIBLE_PER_SOURCE = 1;

export default function FirmwareCandidates() {
  const { t } = useTranslation();
  // One toggle for the table. It was one per source when each source was its
  // own box; in a single table, unfolding one source's history in the middle
  // of the others' newest rows read as a jumble.
  const [expanded, setExpanded] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
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

  const sources = catalog.data?.sources ?? [];
  // Collapsed: each source's newest, whatever its relation to the running
  // version -- filtering by relation left a source with nothing to show the
  // moment a board ran something no source offered yet. Anything newer than
  // what runs goes to the top, because that is what the page is opened for.
  const newest = sources.flatMap((source) =>
    source.candidates
      .slice(0, VISIBLE_PER_SOURCE)
      .map((candidate) => ({ source, candidate }))
  );
  newest.sort(
    (a, b) =>
      Number(b.candidate.relation === "newer") -
      Number(a.candidate.relation === "newer")
  );
  // Expanded: every candidate, grouped by source in the daemon's order.
  const rows = expanded
    ? sources.flatMap((source) =>
        source.candidates.map((candidate) => ({ source, candidate }))
      )
    : newest;
  const total = sources.reduce((n, s) => n + s.candidates.length, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("firmwareUpgrade.availableTitle")}</CardTitle>
        {/* When it last looked. Without this the page asserts "current" from
          data up to half an hour old, which is a claim about the present
          tense made from the past. */}
        {catalog.data && (
          <CardDescription className="max-sm:col-span-2">
            {catalog.data.refreshing
              ? t("firmwareUpgrade.checking")
              : t("firmwareUpgrade.checkedAt", {
                  at: catalog.data.checked_at,
                })}{" "}
            ·{" "}
            {t("firmwareUpgrade.runningIs", { version: catalog.data.running })}
          </CardDescription>
        )}
        {/* Under the title on a phone: beside it, three buttons squeezed the
          title and the checked-at line into a column a word wide. */}
        <CardAction className="flex flex-wrap justify-end gap-2 max-sm:col-span-2 max-sm:col-start-1 max-sm:row-span-1 max-sm:row-start-3 max-sm:mt-2 max-sm:justify-self-start">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setUploadOpen(true)}
          >
            <Upload data-icon="inline-start" />
            {t("firmwareUpgrade.uploadButton")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSourcesOpen(true)}
          >
            <Settings2 data-icon="inline-start" />
            {t("firmwareUpgrade.sourcesButton")}
          </Button>
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

        {/* An error is never rendered as "nothing new": a source that could
          not be read says so above the table, by name, rather than simply
          contributing no rows. */}
        {sources
          .filter((source) => source.error)
          .map((source) => (
            <Alert key={source.id} variant="warning">
              <AlertTriangle />
              <AlertTitle>{source.label}</AlertTitle>
              <AlertDescription>
                {t("firmwareUpgrade.sourceUnreadable", {
                  reason: source.error,
                })}
              </AlertDescription>
            </Alert>
          ))}

        {rows.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("firmwareUpgrade.colVersion")}</TableHead>
                <TableHead className="hidden sm:table-cell">
                  {t("firmwareUpgrade.colSource")}
                </TableHead>
                <TableHead className="hidden sm:table-cell">
                  {t("firmwareUpgrade.colChecksum")}
                </TableHead>
                <TableHead>
                  <span className="sr-only">
                    {t("firmwareUpgrade.install")}
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ source, candidate }) => (
                <CandidateRow
                  key={`${source.id}-${candidate.version}`}
                  source={source}
                  candidate={candidate}
                  busy={install.isPending}
                  installing={
                    install.isPending &&
                    install.variables?.source === source.id &&
                    install.variables?.version === candidate.version
                  }
                  onInstall={(c) => setConfirming({ source, candidate: c })}
                />
              ))}
            </TableBody>
          </Table>
        )}

        {/* A readable source with nothing on it is still named, so its
          silence is not mistaken for a source that is missing. */}
        {sources
          .filter((source) => !source.error && source.candidates.length === 0)
          .map((source) => (
            <p key={source.id} className="text-sm text-muted-foreground">
              {source.label}: {t("firmwareUpgrade.sourceEmpty")}
            </p>
          ))}

        {total > newest.length && (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="self-start px-0 text-muted-foreground"
            onClick={() => setExpanded((open) => !open)}
          >
            {expanded
              ? t("firmwareUpgrade.showFewer")
              : t("firmwareUpgrade.showAllVersions", { count: total })}
          </Button>
        )}

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
        <FirmwareSources open={sourcesOpen} onOpenChange={setSourcesOpen} />
        <FirmwareUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
      </CardContent>
    </Card>
  );
}
