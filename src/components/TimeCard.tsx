import { useState } from "react";
import { useTranslation } from "react-i18next";

import LoadingButton from "@/components/LoadingButton";
import TextField from "@/components/TextField";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useNtpQuery } from "@/lib/api/get";
import { useSetNtpMutation } from "@/lib/api/set";

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
  const sources = ntp.data?.sources ?? [];
  const state = (() => {
    if (!clock) return null;
    if (clock.synchronised === true) {
      const parts = [t("settings.timeSynchronised")];
      if (clock.source) parts.push(clock.source);
      if (clock.stratum != null)
        parts.push(t("settings.timeStratum", { stratum: clock.stratum }));
      if (clock.offset_seconds != null)
        parts.push(
          t("settings.timeOffset", {
            ms: (clock.offset_seconds * 1000).toFixed(1),
          })
        );
      return parts.join(" · ");
    }
    if (clock.synchronised === false) return t("settings.timeNotSynchronised");
    return t("settings.timeUnknown");
  })();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.timeTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* A list that is saved and never read is the one failure showing the
          servers cannot reveal, so it is said outright. */}
        {ntp.data?.configurable === false && (
          <p className="mb-3 text-sm font-medium text-destructive">
            {t("settings.timeNotConfigurable")}
          </p>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <TextField
            name="ntpServers"
            label={t("settings.timeTitle")}
            hideLabel
            className="max-w-xl"
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

        <p className="mt-2 text-sm text-muted-foreground">
          {t("settings.timeNote")}
        </p>
        {state && <p className="mt-1 text-sm font-medium">{state}</p>}

        {/* What chrony thinks of each source. "NOT synchronised" alone sent a
          user to Discord with nothing to act on; chrony always knows why, and
          every line here is its own column put into words. */}
        {sources.length > 0 && (
          <div className="mt-3">
            <div className="mb-1 text-sm font-medium text-muted-foreground">
              {t("settings.timeSources")}
            </div>
            <ul className="flex flex-col gap-0.5 text-sm">
              {sources.map((source) => (
                <li
                  key={`${source.kind}:${source.name}`}
                  className="flex flex-wrap gap-x-2"
                >
                  <span className="font-mono">{source.name}</span>
                  <span
                    className={
                      source.state === "selected"
                        ? "font-medium"
                        : source.state === "unreachable" ||
                            source.state === "falseticker" ||
                            source.state === "unresolved"
                          ? "font-medium text-warning"
                          : "text-muted-foreground"
                    }
                  >
                    {t(`settings.timeSourceState.${source.state}`)}
                  </span>
                  <span className="text-muted-foreground">
                    {t("settings.timeSourceReach", { reach: source.reach })}
                    {" · "}
                    {t("settings.timeSourceStratum", {
                      stratum: source.stratum,
                    })}
                    {source.state !== "unreachable" &&
                      source.state !== "unresolved" && (
                        <>
                          {" · "}
                          {t("settings.timeSourceOffset", {
                            ms: (source.offset_seconds * 1000).toFixed(1),
                          })}
                        </>
                      )}
                    {source.configured &&
                      ` · ${t("settings.timeSourceConfigured")}`}
                  </span>
                </li>
              ))}
            </ul>
            {!sources.some((source) => source.state === "selected") && (
              <p className="mt-2 text-sm text-warning">
                {t("settings.timeNoSourceSelected")}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
