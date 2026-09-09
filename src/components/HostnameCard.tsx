import { useState } from "react";
import { useTranslation } from "react-i18next";

import ConfirmationModal from "@/components/ConfirmationModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  const [draft, setDraft] = useState("");
  const [confirming, setConfirming] = useState(false);

  const current = hostname.data?.hostname ?? "";
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
    <div>
      <div className="mb-6 text-lg font-bold">
        {t("settings.hostnameTitle")}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          name="hostname"
          label={t("settings.hostnameTitle")}
          className="max-w-xs"
          value={draft}
          spellCheck={false}
          autoCapitalize="none"
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button
          type="button"
          disabled={!changed || rename.isPending}
          isLoading={rename.isPending}
          onClick={() => setConfirming(true)}
        >
          {t("ui.save")}
        </Button>
      </div>

      {/* Only when they disagree, which means someone has run `hostname` by
          hand. Saying it on every board would be noise. */}
      {disagrees && (
        <p className="mt-2 text-sm opacity-60">
          {t("settings.hostnameNextBoot", { name: nextBoot })}
        </p>
      )}

      <p className="mt-2 text-sm opacity-60">{t("settings.hostnameNote")}</p>

      <ConfirmationModal
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={apply}
        title={t("settings.hostnameConfirmTitle")}
        message={t("settings.hostnameConfirm", { name: draft.trim() })}
      />
    </div>
  );
}
