import { filesize } from "filesize";
import { CircleCheck, TriangleAlert, Undo2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import LoadingButton from "@/components/LoadingButton";
import RebootModal from "@/components/RebootModal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useConnection } from "@/hooks/useConnection";
import {
  type FirmwareSlot,
  useFirmwareSlotsQuery,
  useUpdateCheckQuery,
} from "@/lib/api/get";
import { useRebootBMCMutation } from "@/lib/api/set";
import {
  isReading,
  parseBoardDate,
  promotionOutcome,
  versionLabel,
} from "@/lib/format";

const human = (bytes: number) => filesize(bytes, { standard: "jedec" });
import InfoNote from "@/components/InfoNote";

/**
 * One slot's cell: the version if it can be read, and the volume behind it.
 *
 * The version is rendered as a version only when the daemon sent one. A null
 * is not an empty string and must not become one: on the rollback slot it is
 * the normal, permanent answer, because that volume is not mounted and its
 * version genuinely cannot be read from a running system. A dash there would
 * read as "the daemon forgot"; a version copied from anywhere else would be
 * a fabrication about the firmware a rollback lands on.
 *
 * The detail line is assembled from whichever parts survive a finiteness
 * check, the same way the switch panel builds its rate line. A daemon that
 * omits `volume_id` loses that fragment rather than printing "id undefined".
 */
function SlotBody({ slot }: { slot: FirmwareSlot | null }) {
  const { t } = useTranslation();

  if (slot === null) {
    return (
      <span className="text-muted-foreground">
        {t("firmwareUpgrade.slotMissing")}
      </span>
    );
  }

  const detail = [
    slot.volume,
    isReading(slot.volume_id)
      ? t("firmwareUpgrade.slotVolumeId", { id: slot.volume_id })
      : null,
    isReading(slot.size_bytes) ? human(slot.size_bytes) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-0.5">
      {slot.version === null || slot.version === "" ? (
        <span className="font-medium text-muted-foreground">
          {t("firmwareUpgrade.slotVersionUnreadable")}
        </span>
      ) : (
        <span className="font-medium">{versionLabel(slot.version)}</span>
      )}
      {detail !== "" && (
        <span className="text-sm text-muted-foreground">{detail}</span>
      )}
    </div>
  );
}

/**
 * The gate's verdict as a word and a colour. Only a verdict the message
 * states plainly gets green or amber; see `promotionOutcome`.
 */
function PromotionBadge({ message }: { message: string }) {
  const { t } = useTranslation();
  const outcome = promotionOutcome(message);

  if (outcome === "passed") {
    return (
      <Badge variant="success">
        <CircleCheck data-icon="inline-start" />
        {t("firmwareUpgrade.promotionPassed")}
      </Badge>
    );
  }
  if (outcome === "rolledBack") {
    return (
      <Badge variant="warning">
        <Undo2 data-icon="inline-start" />
        {t("firmwareUpgrade.promotionRolledBack")}
      </Badge>
    );
  }
  return (
    <Badge variant="outline">{t("firmwareUpgrade.promotionUnknown")}</Badge>
  );
}

/** One labelled value in the slots grid. */
function Tile({ term, value }: { term: ReactNode; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        {term}
      </dt>
      <dd className="flex flex-col gap-0.5">{value}</dd>
    </div>
  );
}

function SlotsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex flex-row py-1">
          <div className="w-1/2 lg:w-1/4">
            <Skeleton className="h-6 w-20" />
          </div>
          <Skeleton className="h-6 w-44" />
        </div>
      ))}
    </div>
  );
}

/**
 * The board's A/B firmware state, on the tab that changes it.
 *
 * This board updates firmware into whichever of two root volumes is not
 * running and switches over on the next boot. The page that performs that
 * update has, until now, said nothing about which slot is running, what a
 * rollback would land on, or whether an update is already waiting for a
 * reboot -- so the one screen where those facts decide what you do next was
 * the one screen that did not have them.
 *
 * Four things are shown and they answer four different questions:
 *
 * - **running** -- the version this BMC is executing right now, which is the
 *   same string the header prints and is here so the two can be compared
 *   against what you are about to upload.
 * - **rollback** -- the volume a rollback lands on, with its version left
 *   deliberately unread; see `SlotBody`.
 * - **update staged** -- whether a reboot will switch slots. Three-valued,
 *   because "the environment could not be read" is not "no".
 * - **last promotion** -- the boot-time health gate's own verdict. A board
 *   that came up, failed its own checks and put itself back on the previous
 *   firmware reports that here and in no other place this interface can see.
 *
 * The panel sits above the upload form rather than below it: it describes
 * where the board is, and the form is what changes that.
 */
export default function FirmwareSlots() {
  const {
    t,
    i18n: { language },
  } = useTranslation();
  const { data, isPending, isError } = useFirmwareSlotsQuery();
  const update = useUpdateCheckQuery();

  const promotion = data?.last_promotion ?? null;
  const promotionDate = promotion ? parseBoardDate(promotion.timestamp) : null;
  // Which slot the next boot takes, and when and from where the staged image
  // came -- whichever of those the daemon reported.
  const nextDetail = [
    data?.nextboot,
    data?.staged?.staged_at,
    data?.staged?.source,
  ]
    .filter(Boolean)
    .join(" · ");
  const { toast } = useToast();
  const { expectReboot } = useConnection();
  const [rebootModalOpened, setRebootModalOpened] = useState(false);
  const { mutate: mutateRebootBMC, isPending: rebootPending } =
    useRebootBMCMutation();

  const handleRebootBMC = () => {
    setRebootModalOpened(false);
    mutateRebootBMC(undefined, {
      // See the Settings button: this names the wait so the banner can too.
      onSuccess: () => {
        expectReboot();
        toast({
          title: t("info.rebootButton"),
          description: t("info.rebootSuccess"),
        });
      },
      onError: (e) =>
        toast({
          title: t("info.rebootFailed"),
          description: e.message,
          variant: "destructive",
        }),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("firmwareUpgrade.firmwareSlots")}</CardTitle>
        {/* The answer to "am I current", before any detail. Only from a
          channel that resolved: an unanswered check is not "up to date". */}
        {update.data?.stable && (
          <CardAction>
            {update.data.stable.update_available ? (
              <Badge variant="warning">
                {t("firmwareUpgrade.statusUpdate", {
                  version: update.data.stable.target,
                })}
              </Badge>
            ) : (
              <Badge variant="secondary">
                {t("firmwareUpgrade.statusCurrent")}
              </Badge>
            )}
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isPending && <SlotsSkeleton />}

        {isError && (
          <p className="text-sm text-muted-foreground">
            {t("firmwareUpgrade.slotsUnavailable")}
          </p>
        )}

        {data && !data.present && (
          <p className="text-sm text-muted-foreground">
            {t("firmwareUpgrade.slotsAbsent")}
          </p>
        )}

        {data?.present && (
          <>
            {/* Amber, and above the rows, because it is the one fact here that
              changes what the next reboot does. Not red: a staged update is
              the expected end of a successful upload, and an interface that
              cries fault at its own success teaches people to ignore it. */}
            {data.update_staged === true && (
              <Alert variant="warning">
                <TriangleAlert />
                <AlertTitle>{t("firmwareUpgrade.slotStagedTitle")}</AlertTitle>
                <AlertDescription className="flex flex-col items-start gap-3">
                  <p>
                    {data.staged?.version
                      ? t("firmwareUpgrade.slotStagedDescriptionNamed", {
                          version: data.staged.version,
                        })
                      : t("firmwareUpgrade.slotStagedDescription")}
                  </p>
                  {/* The one action this notice implies, next to the notice.
                    Until now it lived on another page: install here, then go
                    to Settings to reboot -- and the two are one operation, so
                    people either forgot or rebooted from the wrong place. */}
                  <LoadingButton
                    type="button"
                    variant="destructive"
                    size="sm"
                    isLoading={rebootPending}
                    disabled={rebootPending}
                    onClick={() => setRebootModalOpened(true)}
                  >
                    {t("firmwareUpgrade.rebootToApply")}
                  </LoadingButton>
                </AlertDescription>
              </Alert>
            )}

            {/* Four tiles instead of a long list: each is one question
              (what runs, what a rollback lands on, what the next boot does,
              what the channel offers), and on a laptop they fit in one
              glance rather than a screen of rows. */}
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <Tile
                term={t("firmwareUpgrade.slotRunning")}
                value={<SlotBody slot={data.running} />}
              />
              <Tile
                term={
                  <>
                    {t("firmwareUpgrade.slotRollback")}
                    <InfoNote
                      text={t("firmwareUpgrade.slotRollbackNote")}
                      path="/features/updates-that-undo-themselves/"
                      label={t("firmwareUpgrade.slotRollback")}
                    />
                  </>
                }
                value={<SlotBody slot={data.rollback} />}
              />
              {/* Staged, staged version and next boot were three rows saying
                one thing: what the next reboot starts. `update_staged` stays
                three-valued -- "could not be read" is not "no" -- and a
                staged flag with no note still reads as staged, never as
                nothing. */}
              <Tile
                term={t("firmwareUpgrade.slotNextboot")}
                value={
                  <>
                    {data.update_staged === true && (
                      <span className="font-medium text-warning">
                        {data.staged?.version ??
                          data.staged?.file ??
                          t("firmwareUpgrade.slotStagedUnnamed")}
                      </span>
                    )}
                    {data.update_staged === false && (
                      <span className="font-medium">
                        {t("firmwareUpgrade.slotNothingStaged")}
                      </span>
                    )}
                    {data.update_staged === null && (
                      <span className="text-muted-foreground">
                        {t("firmwareUpgrade.slotStagedUnknown")}
                      </span>
                    )}
                    {nextDetail !== "" && (
                      <span className="text-sm text-muted-foreground">
                        {nextDetail}
                      </span>
                    )}
                  </>
                }
              />
              {/* The upgrade candidate. Its own query, so a slow or failing
                check never holds up the tiles beside it -- and a channel that
                could not be resolved says so, rather than rendering as "no
                update", which is a different claim. */}
              {update.data &&
                (Boolean(update.data.stable) || Boolean(update.data.error)) && (
                  <Tile
                    term={t("firmwareUpgrade.updateStable")}
                    value={
                      update.data.stable ? (
                        <>
                          <span className="font-medium">
                            {update.data.stable.target}
                          </span>
                          {update.data.edge &&
                            update.data.edge.target !==
                              update.data.stable.target && (
                              <span className="text-sm text-muted-foreground">
                                {t("firmwareUpgrade.updateEdge")}{" "}
                                {update.data.edge.target}
                              </span>
                            )}
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {t("firmwareUpgrade.updateUnavailable")}
                        </span>
                      )
                    }
                  />
                )}
              {/* The boot-time health gate's own verdict: it matters when it
                says the board put itself back, and it says that here and
                nowhere else. */}
              {promotion && (
                <Tile
                  term={
                    <>
                      {t("firmwareUpgrade.slotPromotion")}
                      <InfoNote
                        text={t("firmwareUpgrade.slotPromotionNote")}
                        path="/reference/gate-history/"
                        label={t("firmwareUpgrade.slotPromotion")}
                      />
                    </>
                  }
                  value={
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {/* The gate's own words stay on hover: the badge is
                        read from them, and "Recorded" is exactly the case
                        where a reader needs to see what was written. */}
                      <span title={promotion.message}>
                        <PromotionBadge message={promotion.message} />
                      </span>
                      {/* The board's own clock at that moment, which on a
                        BMC that had just come up may be behind; the stamp
                        as it was written stays on hover. */}
                      <span
                        className="text-sm text-muted-foreground"
                        title={promotion.timestamp}
                      >
                        {promotionDate
                          ? promotionDate.toLocaleString(language, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : promotion.timestamp}
                      </span>
                    </div>
                  }
                />
              )}
            </dl>
          </>
        )}

        <RebootModal
          isOpen={rebootModalOpened}
          onClose={() => setRebootModalOpened(false)}
          onReboot={handleRebootBMC}
          title={t("firmwareUpgrade.rebootToApply")}
          message={t("firmwareUpgrade.rebootToApplyConfirm")}
        />
      </CardContent>
    </Card>
  );
}
