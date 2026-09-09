import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  const [draft, setDraft] = useState("");
  const configured = (ntp.data?.servers ?? []).join(", ");
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
    <div>
      <div className="mb-6 text-lg font-bold">{t("settings.timeTitle")}</div>

      {/* A list that is saved and never read is the one failure showing the
          servers cannot reveal, so it is said outright. */}
      {ntp.data?.configurable === false && (
        <p className="mb-3 text-sm font-semibold text-red-700 dark:text-red-400">
          {t("settings.timeNotConfigurable")}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Input
          name="ntpServers"
          label={t("settings.timeTitle")}
          className="max-w-xl"
          value={draft}
          spellCheck={false}
          autoCapitalize="none"
          placeholder={t("settings.timePlaceholder")}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button
          type="button"
          disabled={
            !changed || save.isPending || ntp.data?.configurable === false
          }
          isLoading={save.isPending}
          onClick={apply}
        >
          {t("ui.save")}
        </Button>
      </div>

      <p className="mt-2 text-sm opacity-60">{t("settings.timeNote")}</p>
      {state && <p className="mt-1 text-sm font-semibold">{state}</p>}
    </div>
  );
}
