import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { type FirmwareSource, useFirmwareSourcesQuery } from "@/lib/api/get";
import { useSetFirmwareSourcesMutation } from "@/lib/api/set";

/**
 * Where the board looks for firmware.
 *
 * The form documents the layout each kind expects, because the commonest
 * mistake is invisible: point an HTTP source at a `.tpu` instead of the
 * directory holding version folders and it lists nothing -- which looks
 * exactly like a source that has nothing new. The daemon refuses that on
 * write, but a form that only says "URL" invites it.
 */
const KIND_HELP: Record<FirmwareSource["kind"], string> = {
  github: "firmwareUpgrade.sourceHelpGithub",
  http: "firmwareUpgrade.sourceHelpHttp",
  local: "firmwareUpgrade.sourceHelpLocal",
};

const KIND_PLACEHOLDER: Record<FirmwareSource["kind"], string> = {
  github: "excavador/tp2-bmc-firmware",
  http: "https://firmware.turingpi.com/turing-pi2",
  local: "/mnt/sdcard/firmware",
};

export default function FirmwareSources() {
  const { t } = useTranslation();
  const query = useFirmwareSourcesQuery();
  const save = useSetFirmwareSourcesMutation();
  // `null` means "not edited yet", and the form reads through to whatever the
  // board reports. Deriving it beats seeding state from an effect: an effect
  // would set state during render and, worse, would quietly discard an edit
  // the moment the query refetched underneath it.
  const [draft, setDraft] = useState<FirmwareSource[] | null>(null);
  const sources = draft ?? query.data?.sources ?? [];
  const dirty =
    query.data !== undefined &&
    draft !== null &&
    JSON.stringify(draft) !== JSON.stringify(query.data.sources);

  const update = (index: number, patch: Partial<FirmwareSource>) =>
    setDraft(sources.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const add = () =>
    setDraft([
      ...sources,
      {
        // An id the install call refers to; renaming the label must not
        // change what an install means, so they are separate fields.
        id: `source-${sources.length + 1}`,
        kind: "github",
        label: "",
        location: "",
        enabled: true,
      },
    ]);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">
        {t("firmwareUpgrade.sourcesTitle")}
      </h2>
      <p className="text-sm opacity-70">
        {t("firmwareUpgrade.sourcesDescription")}
      </p>

      {sources.map((source, index) => (
        <div key={index} className="flex flex-col gap-2 rounded-md border p-3">
          {/* At 390 px this row used to break: the location field's 16rem
              minimum forced it onto its own line, and the delete button
              orphaned below it. So stack deliberately on small screens -- one
              field per row, with delete as a trailing icon on the label's row
              -- and let `sm:contents` dissolve the wrapper above that width so
              the desktop layout is exactly the single flex row it always was. */}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex items-center gap-2 sm:contents">
              <input
                className="h-9 min-w-0 flex-1 rounded-md border bg-transparent px-2 text-sm sm:w-40 sm:flex-none"
                aria-label={t("firmwareUpgrade.sourceLabel")}
                placeholder={t("firmwareUpgrade.sourceLabel")}
                value={source.label}
                onChange={(e) => update(index, { label: e.target.value })}
              />
              <Button
                variant="bwSquare"
                size="icon"
                className="shrink-0 sm:order-last"
                aria-label={t("firmwareUpgrade.sourceRemove")}
                onClick={() => setDraft(sources.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            <select
              className="h-9 rounded-md border bg-transparent px-2 text-sm"
              aria-label={t("firmwareUpgrade.sourceKind")}
              value={source.kind}
              onChange={(e) =>
                update(index, {
                  kind: e.target.value as FirmwareSource["kind"],
                })
              }
            >
              <option value="github">github</option>
              <option value="http">http</option>
              <option value="local">local</option>
            </select>
            <input
              className="h-9 w-full min-w-0 rounded-md border bg-transparent px-2 font-mono text-sm sm:w-auto sm:min-w-64 sm:flex-1"
              aria-label={t("firmwareUpgrade.sourceLocation")}
              placeholder={KIND_PLACEHOLDER[source.kind]}
              value={source.location}
              onChange={(e) => update(index, { location: e.target.value })}
            />
            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={source.enabled}
                onChange={(e) => update(index, { enabled: e.target.checked })}
              />
              {t("firmwareUpgrade.sourceEnabled")}
            </label>
          </div>
          {/* The layout this kind expects, spelled out. */}
          <p className="text-xs opacity-60">{t(KIND_HELP[source.kind])}</p>
        </div>
      ))}

      <div className="flex gap-2">
        <Button variant="bw" onClick={add}>
          <Plus className="mr-2 size-4" />
          {t("firmwareUpgrade.sourceAdd")}
        </Button>
        <Button
          disabled={!dirty || save.isPending}
          onClick={() => void save.mutateAsync({ sources })}
        >
          {t("firmwareUpgrade.sourcesSave")}
        </Button>
        {dirty && (
          <Button
            variant="bw"
            onClick={() => setDraft(query.data?.sources ?? [])}
          >
            {t("ui.cancel")}
          </Button>
        )}
      </div>

      {save.isError && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {t("firmwareUpgrade.sourcesRejected")}
        </p>
      )}
    </div>
  );
}
