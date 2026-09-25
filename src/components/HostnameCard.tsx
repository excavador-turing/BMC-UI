import { useState } from "react";
import { useTranslation } from "react-i18next";

import ConfirmationModal from "@/components/ConfirmationModal";
import LoadingButton from "@/components/LoadingButton";
import TextField from "@/components/TextField";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useHostnameQuery } from "@/lib/api/get";
import { useSetHostnameMutation } from "@/lib/api/set";

/**
 * The board's name.
 *
 * Renaming used to be an SSH session. It is a control now because there is a
 * board B in the plan, and a name that assumes one board has to change later,
 * under time pressure, with the second board already on the bench.
 *
 * The confirmation is not ceremony. The name is the metrics `instance` label,
 * so a Prometheus history does not follow the board across a rename — and
 * renaming back does not undo it, because the series has already split. That
 * is said before the button is pressed, not in a toast afterwards.
 */
export default function HostnameCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const hostname = useHostnameQuery();
  const rename = useSetHostnameMutation();

  const current = hostname.data?.hostname ?? "";
  // Seeded from the query, not from "": with the answer already cached at
  // mount, `seen` below starts equal to `current` and never re-seeds an
  // empty draft. Same slip as the time card's.
  const [draft, setDraft] = useState(current);
  const [confirming, setConfirming] = useState(false);

  // React's own pattern for resetting local state when the value behind it
  // changes: adjust during render rather than in an effect, which would
  // commit once with the stale value and then again with the new one.
  const [seen, setSeen] = useState(current);
  if (seen !== current) {
    setSeen(current);
    setDraft(current);
  }

  // An older daemon has no such endpoint. A card that cannot work is not shown
  // as a card that is broken.
  if (hostname.isError) return null;

  const changed = draft.trim() !== "" && draft.trim() !== current;
  const nextBoot = hostname.data?.on_next_boot;
  const disagrees = nextBoot != null && nextBoot !== current;

  const apply = () => {
    setConfirming(false);
    rename.mutate(draft.trim(), {
      onSuccess: () =>
        toast({
          title: t("settings.hostnameTitle"),
          description: t("settings.hostnameRenamed", { name: draft.trim() }),
        }),
      onError: (e) =>
        toast({
          title: t("settings.hostnameTitle"),
          description: e.message,
          variant: "destructive",
        }),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.hostnameTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-end gap-2">
          <TextField
            name="hostname"
            label={t("settings.hostnameTitle")}
            hideLabel
            className="max-w-xs min-w-0 flex-1"
            value={draft}
            spellCheck={false}
            autoCapitalize="none"
            onChange={(e) => setDraft(e.target.value)}
          />
          <LoadingButton
            type="button"
            disabled={!changed || rename.isPending}
            isLoading={rename.isPending}
            onClick={() => setConfirming(true)}
          >
            {t("ui.save")}
          </LoadingButton>
        </div>

        {/* Only when they disagree, which means someone has run `hostname` by
          hand. Saying it on every board would be noise. */}
        {disagrees && (
          <p className="text-sm text-muted-foreground">
            {t("settings.hostnameNextBoot", { name: nextBoot })}
          </p>
        )}

        <p className="text-sm text-muted-foreground">
          {t("settings.hostnameNote")}
        </p>

        <ConfirmationModal
          isOpen={confirming}
          onClose={() => setConfirming(false)}
          onConfirm={apply}
          title={t("settings.hostnameConfirmTitle")}
          message={t("settings.hostnameConfirm", { name: draft.trim() })}
        />
      </CardContent>
    </Card>
  );
}
