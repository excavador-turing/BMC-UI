import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  const kinds = [
    { value: "github", label: "github" },
    { value: "http", label: "http" },
    { value: "local", label: "local" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("firmwareUpgrade.sourcesTitle")}</CardTitle>
        <CardDescription>
          {t("firmwareUpgrade.sourcesDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {sources.map((source, index) => (
          <div
            key={index}
            className="flex flex-col gap-2 rounded-lg border p-3"
          >
            {/* At 390 px this row used to break: the location field's 16rem
                minimum forced it onto its own line, and the delete button
                orphaned below it. So stack deliberately on small screens --
                one field per row, with delete as a trailing icon on the
                label's row -- and let `sm:contents` dissolve the wrapper above
                that width so the desktop layout is the single flex row it
                always was. */}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="flex items-center gap-2 sm:contents">
                <Input
                  className="min-w-0 flex-1 sm:w-40 sm:flex-none"
                  aria-label={t("firmwareUpgrade.sourceLabel")}
                  placeholder={t("firmwareUpgrade.sourceLabel")}
                  value={source.label}
                  onChange={(e) => update(index, { label: e.target.value })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 sm:order-last"
                  aria-label={t("firmwareUpgrade.sourceRemove")}
                  onClick={() =>
                    setDraft(sources.filter((_, i) => i !== index))
                  }
                >
                  <Trash2 />
                </Button>
              </div>
              <Select
                items={kinds}
                value={source.kind}
                onValueChange={(kind) => {
                  if (kind !== null) update(index, { kind: kind });
                }}
              >
                <SelectTrigger aria-label={t("firmwareUpgrade.sourceKind")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {kinds.map((kind) => (
                      <SelectItem key={kind.value} value={kind.value}>
                        {kind.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Input
                className="w-full min-w-0 font-mono sm:w-auto sm:min-w-64 sm:flex-1"
                aria-label={t("firmwareUpgrade.sourceLocation")}
                placeholder={KIND_PLACEHOLDER[source.kind]}
                value={source.location}
                onChange={(e) => update(index, { location: e.target.value })}
              />
              <Field orientation="horizontal" className="w-auto">
                <Checkbox
                  id={`source-enabled-${index}`}
                  checked={source.enabled}
                  onCheckedChange={(enabled) => update(index, { enabled })}
                />
                <FieldLabel
                  htmlFor={`source-enabled-${index}`}
                  className="font-normal"
                >
                  {t("firmwareUpgrade.sourceEnabled")}
                </FieldLabel>
              </Field>
            </div>
            {/* The layout this kind expects, spelled out. */}
            <p className="text-xs text-muted-foreground">
              {t(KIND_HELP[source.kind])}
            </p>
          </div>
        ))}

        {save.isError && (
          <p className="text-sm text-destructive">
            {t("firmwareUpgrade.sourcesRejected")}
          </p>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline" onClick={add}>
          <Plus data-icon="inline-start" />
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
            variant="outline"
            onClick={() => setDraft(query.data?.sources ?? [])}
          >
            {t("ui.cancel")}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
