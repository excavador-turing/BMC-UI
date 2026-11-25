import { useMutationState } from "@tanstack/react-query";
import {
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Settings2,
  ShieldCheck,
  ShieldQuestion,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import UsageBar from "@/components/UsageBar";
import { useFlash } from "@/hooks/use-flash";
import { bmcdMessage } from "@/lib/api/bmcdMessage";
import {
  type BadgeRequest,
  type InstallSnapshot,
  refreshPollDelayMs,
  singleFlight,
  snapshotFromBadge,
  snapshotFromRow,
} from "@/lib/api/firmwarePage";
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

/** What `useInstallFirmwareMutation` is called with, for reading it back. */
interface InstallVariables {
  source: string;
  version: string;
}

/**
 * Where an install stands, on the page.
 *
 * It used to sit in the card's foot under a confirmation dialog that stayed
 * open until the board answered, so the progress was behind the backdrop and
 * the dialog was the only thing that could be looked at for the best part of
 * half a minute. Closing the dialog loses nothing: the install is one request
 * that the page keeps in flight, and the board finishes it whether or not a
 * dialog is showing. What it does depend on is this page staying open --
 * reloading or closing the tab ends the request that carries the answer -- so
 * that is what the text says.
 *
 * A failure stays until it is dismissed: it used to be a toast, gone in
 * seconds, and the dialog that held the reason was already closed.
 */
function InstallStatus({
  installing,
  succeeded,
  version,
  elapsed,
  error,
  onDismiss,
}: {
  installing: boolean;
  succeeded: boolean;
  version: string | undefined;
  elapsed: number;
  error: string | null;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();

  if (installing) {
    return (
      <div role="status" aria-live="polite" className="flex flex-col gap-2">
        <p className="text-sm text-warning">
          {elapsed > EXPECTED_INSTALL_SECONDS
            ? t("firmwareUpgrade.installingOverdue", { version, elapsed })
            : t("firmwareUpgrade.installingNow", {
                version,
                expected: EXPECTED_INSTALL_SECONDS,
                elapsed,
              })}
        </p>
        <UsageBar
          aria-label={t("firmwareUpgrade.ariaProgress")}
          value={100}
          pulsing
        />
        <p className="text-sm text-muted-foreground">
          {t("firmwareUpgrade.keepPageOpen")}
        </p>
      </div>
    );
  }

  if (error !== null) {
    return (
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>{t("firmwareUpgrade.installFailed")}</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-2">
          <p>{error}</p>
          <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
            {t("firmwareUpgrade.dismiss")}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (succeeded) {
    return (
      <p className="text-sm text-warning">
        {t("firmwareUpgrade.installStaged")}
      </p>
    );
  }

  return null;
}

/**
 * The upload's progress, beside the list, while its dialog is closed.
 *
 * The upload and the write that follows run in the page-wide flash state, not
 * in the dialog, so closing the dialog does not touch them; this is the only
 * sign of them left on screen.
 */
function UploadStatus({
  busy,
  message,
  progress,
  error,
  onDismiss,
}: {
  busy: boolean;
  message: string;
  progress?: { transferred: string; total: string | null; pct: number };
  error: string | null;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();

  if (!busy && error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>{t("firmwareUpgrade.uploadFailed")}</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-2">
          <p>{error}</p>
          <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
            {t("firmwareUpgrade.dismiss")}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-2">
      <p className="text-sm text-warning">{message}</p>
      {progress && (
        <UsageBar
          aria-label={t("firmwareUpgrade.ariaProgress")}
          value={progress.pct}
          label={`${progress.transferred}${
            progress.total ? ` / ${progress.total}` : ""
          }`}
          pulsing={busy}
        />
      )}
      <p className="text-sm text-muted-foreground">
        {t("firmwareUpgrade.keepPageOpen")}
      </p>
    </div>
  );
}

/** How many of a source's newest candidates are shown before "show all". */
const VISIBLE_PER_SOURCE = 1;

/**
 * A version the page was asked to install without the list having been
 * consulted: the "Update available" badge in the slots panel.
 */
export type InstallRequest = BadgeRequest;

export default function FirmwareCandidates({
  installRequest = null,
  onInstallRequestHandled,
}: {
  installRequest?: InstallRequest | null;
  /** The request was confirmed or cancelled; stop offering it. */
  onInstallRequestHandled?: () => void;
}) {
  const { t } = useTranslation();
  // One toggle for the table. It was one per source when each source was its
  // own box; in a single table, unfolding one source's history in the middle
  // of the others' newest rows read as a jumble.
  const [expanded, setExpanded] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  // What the dialog is asking about, fixed when it was chosen. The catalogue
  // is polled while it checks, and a dialog that re-read it would ask about
  // one thing and install another.
  const [picked, setPicked] = useState<InstallSnapshot | null>(null);

  const catalog = useFirmwareAvailableQuery();
  const install = useInstallFirmwareMutation();
  // The install as the mutation cache sees it, not as this component's own
  // observer does. The confirmation closes the moment it is answered and the
  // reader may move to another tab while the board works; the cache is what
  // still knows about the install when this page is mounted again.
  const installStates = useMutationState({
    filters: { mutationKey: ["installFirmware"] },
    select: (mutation) => mutation.state,
  });
  const installState: (typeof installStates)[number] | undefined =
    installStates[installStates.length - 1];
  const installing = installState?.status === "pending";
  const installVars = installState?.variables as InstallVariables | undefined;
  // The install whose failure was dismissed, by when it was submitted.
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  // The upload as the page-wide flash state sees it: its dialog can be closed
  // while the board works, so the progress has to be on the page too.
  const {
    flashType,
    isFlashing,
    statusMessage,
    firmwareUpdateMutation,
    uploadProgress,
    firmwareError,
    clearFirmwareError,
  } = useFlash();
  const uploading =
    flashType === "firmware" &&
    (firmwareUpdateMutation.isPending || isFlashing);
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
    if (!installing) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [installing]);
  const installElapsed =
    installing && installState
      ? Math.max(0, Math.floor((now - installState.submittedAt) / 1000))
      : 0;

  /**
   * The daemon answers a `refresh` at once and re-polls the sources behind
   * itself, so the new answers arrive after this request has already
   * returned. Poll for them while it says it is still working, and stop when
   * it stops -- rather than leaving the page showing the previous list with
   * no sign that anything is happening.
   *
   * Bounded, and that bound is not a nicety. A daemon that dies mid-fan-out,
   * or any bug that leaves its `refreshing` flag set, used to leave this page
   * polling a 116 MB board every two seconds for as long as a tab stayed open
   * -- which is how a browser left on this page overnight becomes a load
   * generator. But the bound has to be longer than a healthy refresh, and it
   * was not: it was two minutes, on the strength of 16 s measured with one
   * source, and a board with the fork's release list takes 170 s for that
   * list alone (2026-11-01). The page then stopped, still saying "checking",
   * with Check now greyed out until a reload.
   *
   * So it asks for up to eleven minutes -- just past the daemon's own
   * ten-minute claim on a refresh -- backing off as it goes (see
   * `refreshPollDelayMs`), and when it does give up it says so and gives the
   * button back.
   */
  const refreshing = catalog.data?.refreshing === true;
  const { refetch } = catalog;
  const [gaveUp, setGaveUp] = useState(false);
  // Bumped by Check now so a refresh that is still running gets a fresh
  // eleven minutes: `refreshing` stays true across the press and would not
  // restart the effect on its own.
  const [pollRound, setPollRound] = useState(0);
  // A new refresh clears the verdict on the last one. Adjusted during render
  // rather than in the effect, which would set state synchronously.
  const [wasRefreshing, setWasRefreshing] = useState(refreshing);
  if (wasRefreshing !== refreshing) {
    setWasRefreshing(refreshing);
    if (refreshing) setGaveUp(false);
  }
  useEffect(() => {
    if (!refreshing) return;
    const startedAt = Date.now();
    let timer: number | undefined;
    const tick = () => {
      const delay = refreshPollDelayMs(Date.now() - startedAt);
      if (delay === null) {
        setGaveUp(true);
        return;
      }
      timer = window.setTimeout(() => {
        // A tab nobody is looking at does not need the answer yet; the next
        // tick after it comes back to the front asks.
        if (!document.hidden) void refetch();
        tick();
      }, delay);
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [refreshing, pollRound, refetch]);
  const waiting = refreshing && !gaveUp;
  const stale = refreshing && gaveUp;

  const checkNow = async () => {
    setGaveUp(false);
    setPollRound((round) => round + 1);
    setChecking(true);
    try {
      await catalog.checkNow();
    } finally {
      setChecking(false);
    }
  };

  const sources = catalog.data?.sources ?? [];

  // The badge's version, snapshotted the moment the request arrives (set
  // during render, which React allows for state derived from a prop): the row
  // the list already has for it, or -- when the catalogue is behind the
  // update check, which is the case this exists for -- the same request built
  // from the version alone.
  const [seenRequest, setSeenRequest] = useState<InstallRequest | null>(null);
  if (installRequest !== seenRequest) {
    setSeenRequest(installRequest);
    if (installRequest) {
      setPicked(snapshotFromBadge(installRequest, sources));
    }
  }
  const confirming = picked;
  const closeConfirm = () => {
    setPicked(null);
    onInstallRequestHandled?.();
  };

  // One install at a time, however often "Continue" is pressed; see
  // `singleFlight`. A second press used to start a second updater over the
  // first.
  const installGate = useRef(singleFlight());

  const doInstall = async () => {
    if (!confirming) return;
    if (installing || !installGate.current.begin()) return;
    // Exactly what the dialog showed, and nothing re-read since.
    const snapshot = confirming;
    // The dialog closes when it is answered, not when the board has: the
    // board's progress and its answer are on the page, below the card's
    // header, and a dialog held open over them hid both. See
    // `InstallStatus`.
    closeConfirm();
    try {
      await install.mutateAsync({
        source: snapshot.sourceId,
        version: snapshot.version,
        allowDowngrade: snapshot.allowDowngrade,
        // The catalogue reports the path for a local candidate; that is what
        // decides which endpoint this goes to.
        localFile: snapshot.localFile,
      });
    } catch {
      // The query client toasts the refusal with the daemon's reason
      // ("already staged" and "no source called" need different next steps),
      // under firmwareUpgrade.installFailed, and the status block on the page
      // keeps it until it is dismissed.
      return;
    } finally {
      installGate.current.end();
    }
    await catalog.refetch();
  };

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
            {stale
              ? t("firmwareUpgrade.checkingStale")
              : waiting
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
            data-testid="firmware-upload"
          >
            <Upload data-icon="inline-start" />
            {t("firmwareUpgrade.uploadButton")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSourcesOpen(true)}
            data-testid="firmware-sources"
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
            disabled={checking || waiting}
            onClick={() => void checkNow()}
          >
            <RefreshCw
              data-icon="inline-start"
              className={cn((checking || waiting) && "animate-spin")}
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

        <InstallStatus
          installing={installing}
          succeeded={installState?.status === "success"}
          version={installVars?.version}
          elapsed={installElapsed}
          error={
            installState?.status === "error" &&
            installState.submittedAt !== dismissedAt &&
            installState.error
              ? bmcdMessage(installState.error)
              : null
          }
          onDismiss={() => setDismissedAt(installState?.submittedAt ?? null)}
        />
        {/* The upload, for as long as its dialog is closed: the dialog shows
          the same thing while it is open. */}
        {!uploadOpen && (uploading || firmwareError) && (
          <UploadStatus
            busy={uploading}
            message={statusMessage}
            progress={uploadProgress}
            error={firmwareError}
            onDismiss={clearFirmwareError}
          />
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
                  busy={installing || uploading}
                  installing={
                    installing &&
                    installVars?.source === source.id &&
                    installVars?.version === candidate.version
                  }
                  onInstall={(c) => setPicked(snapshotFromRow(source, c))}
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
          onClose={closeConfirm}
          onConfirm={() => void doInstall()}
          // Named for what they do. "Continue" and "Cancel" leave open what is
          // being continued or cancelled, in a dialog that sits over a page
          // with an update that may be staged; cancelling a staged update is
          // its own button, with its own confirmation, in the slots panel.
          confirmLabel={t("firmwareUpgrade.installConfirm")}
          dismissLabel={t("firmwareUpgrade.installDismiss")}
          title={
            confirming
              ? t("firmwareUpgrade.confirmTitle", {
                  version: confirming.version,
                })
              : ""
          }
          message={
            confirming ? (
              <div className="flex flex-col gap-2">
                <p>
                  {confirming.relation === "older"
                    ? t("firmwareUpgrade.confirmDowngrade")
                    : confirming.relation === "unknown"
                      ? t("firmwareUpgrade.confirmUnknown")
                      : t("firmwareUpgrade.confirmUpgrade")}
                </p>
                {/* Where it comes from, for every install the badge starts:
                  the badge names a version, and a version alone does not say
                  which image. */}
                {confirming.viaBadge && confirming.repo && (
                  <p>
                    {t("firmwareUpgrade.confirmFrom", {
                      source: confirming.sourceLabel,
                      repo: confirming.repo,
                    })}
                  </p>
                )}
                {!confirming.listed && (
                  <p>{t("firmwareUpgrade.confirmNotListed")}</p>
                )}
                {confirming.trust !== "verified" && (
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

        <FirmwareSources open={sourcesOpen} onOpenChange={setSourcesOpen} />
        <FirmwareUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
      </CardContent>
    </Card>
  );
}
