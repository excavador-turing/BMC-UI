import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import LoadingButton from "@/components/LoadingButton";
import TextField from "@/components/TextField";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useNtpQuery } from "@/lib/api/get";
import { useSetNtpMutation } from "@/lib/api/set";

/**
 * The board's own time, ticking: this browser's clock plus the offset the
 * daemon measured. Shown so a clock that is wrong reads as wrong at a glance,
 * not only as "not synchronised".
 */
function BoardTime({ offsetSeconds }: { offsetSeconds: number }) {
  const {
    i18n: { language },
  } = useTranslation();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const board = new Date(now + offsetSeconds * 1000);

  // The time large and the date beside it quietly: date and time together at
  // this size wrapped onto two lines on a phone.
  return (
    <span className="flex flex-wrap items-baseline gap-x-3">
      <span className="text-xl font-semibold tabular-nums">
        {board.toLocaleTimeString(language)}
      </span>
      <span className="text-sm text-muted-foreground">
        {board.toLocaleDateString(language, { dateStyle: "medium" })}
      </span>
    </span>
  );
}

/**
 * Which time sources the board uses, and how its clock is doing on them.
 *
 * Both together, because they are one question: a server list with no sync
 * state is a setting nobody can tell the effect of, and the effect is the only
 * reason to change it. The state line polls, so pointing the board at a server
 * that does not answer shows up here within a few seconds rather than at the
 * next page load.
 */
export default function TimeCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const ntp = useNtpQuery();
  const save = useSetNtpMutation();

  const configured = (ntp.data?.servers ?? []).join(", ");
  // Seeded from the query, not from "": when the answer is already in the
  // cache at mount -- any second visit to the tab -- `seen` starts equal to
  // `configured` and the sync below never fires, so a draft seeded empty
  // stayed empty until a refresh cleared the cache. Reported from a 2.4
  // board on 2026-09-21: "the Time box is blank; refresh loads it".
  const [draft, setDraft] = useState(configured);
  // Adjusted during render, not in an effect: an effect would commit the
  // stale value first and the new one immediately after.
  const [seen, setSeen] = useState(configured);
  if (seen !== configured) {
    setSeen(configured);
    setDraft(configured);
  }

  // An older daemon has no such endpoint; a card that cannot work is not shown
  // as a card that is broken.
  if (ntp.isError) return null;

  const parse = (value: string) =>
    value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const changed = draft.trim() !== configured;

  const apply = () => {
    save.mutate(parse(draft), {
      onSuccess: () =>
        toast({
          title: t("settings.timeTitle"),
          description:
            parse(draft).length === 0
              ? t("settings.timeCleared")
              : t("settings.timeSaved"),
        }),
      onError: (e) =>
        toast({
          title: t("settings.timeTitle"),
          description: e.message,
          variant: "destructive",
        }),
    });
  };

  const clock = ntp.data?.clock;
  // What the clock is on, as one quiet line under the time: the source it
  // follows and how far off it is. The yes/no is the badge in the header.
  const detail = [
    clock?.source ?? null,
    clock?.stratum != null
      ? t("settings.timeStratum", { stratum: clock.stratum })
      : null,
    clock?.offset_seconds != null
      ? t("settings.timeOffset", {
          ms: (clock.offset_seconds * 1000).toFixed(1),
        })
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.timeTitle")}</CardTitle>
        {clock && (
          <CardAction>
            {clock.synchronised === true ? (
              <Badge variant="success">{t("settings.timeBadgeSynced")}</Badge>
            ) : clock.synchronised === false ? (
              <Badge variant="warning">
                {t("settings.timeBadgeNotSynced")}
              </Badge>
            ) : (
              <Badge variant="outline" title={t("settings.timeUnknown")}>
                {t("settings.timeBadgeUnknown")}
              </Badge>
            )}
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {clock?.offset_seconds != null && (
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">
              {t("settings.timeBoardTime")}
            </span>
            <BoardTime offsetSeconds={clock.offset_seconds} />
            {detail !== "" && (
              <span className="text-sm text-muted-foreground">{detail}</span>
            )}
          </div>
        )}

        {/* A list that is saved and never read is the one failure showing the
          servers cannot reveal, so it is said outright. */}
        {ntp.data?.configurable === false && (
          <p className="text-sm font-medium text-destructive">
            {t("settings.timeNotConfigurable")}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex items-end gap-2">
            <TextField
              name="ntpServers"
              label={t("settings.timeServers")}
              className="flex-1"
              value={draft}
              spellCheck={false}
              autoCapitalize="none"
              placeholder={t("settings.timePlaceholder")}
              onChange={(e) => setDraft(e.target.value)}
            />
            <LoadingButton
              type="button"
              disabled={
                !changed || save.isPending || ntp.data?.configurable === false
              }
              isLoading={save.isPending}
              onClick={apply}
            >
              {t("ui.save")}
            </LoadingButton>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("settings.timeNote")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
