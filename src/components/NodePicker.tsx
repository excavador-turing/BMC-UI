import { useTranslation } from "react-i18next";

import { Field, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/** The four modules a Turing Pi 2 carries, as the API numbers them. */
const NODE_VALUES = ["0", "1", "2", "3"] as const;

/**
 * Which module a tab acts on: four toggles in a row, one pressed.
 *
 * It was a drop-down. A list that opens to show four fixed entries, one of
 * them already chosen, costs a click and a scan on every visit to Console,
 * USB and Flash -- three tabs whose first question is always "which module".
 * Four options fit on one line at 390px, so nothing needs hiding.
 *
 * `name` renders a hidden input so a form that reads its fields by name (the
 * flash form does) sees the same field a select gave it.
 */
export function NodePicker({
  label,
  name,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      {/* One is always chosen: pressing the pressed one again would empty the
          group, and "no module" is not an answer any of these forms take. */}
      <ToggleGroup
        aria-label={label}
        variant="outline"
        value={[value]}
        onValueChange={(next: string[]) => {
          if (next[0] !== undefined) onChange(next[0]);
        }}
        disabled={disabled}
        className="flex-wrap"
      >
        {NODE_VALUES.map((entry) => (
          <ToggleGroupItem key={entry} value={entry}>
            {t("nodes.node", { nodeId: Number.parseInt(entry) + 1 })}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {name && <input type="hidden" name={name} value={value} />}
    </Field>
  );
}
