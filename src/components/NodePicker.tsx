import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

/** The four modules a Turing Pi 2 carries, as the API numbers them. */
const NODE_VALUES = ["0", "1", "2", "3"] as const;

/**
 * Which module a tab acts on: four pills in a row, the chosen one green.
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
    <div role="radiogroup" aria-label={label} className="space-y-1.5">
      <span className="block text-sm font-semibold opacity-60">{label}</span>
      <div className="flex flex-wrap gap-1">
        {NODE_VALUES.map((entry) => (
          <Button
            key={entry}
            type="button"
            role="radio"
            aria-checked={entry === value}
            size="sm"
            variant={entry === value ? "turing-green" : "bw"}
            disabled={disabled}
            onClick={() => onChange(entry)}
          >
            {t("nodes.node", { nodeId: Number.parseInt(entry) + 1 })}
          </Button>
        ))}
      </div>
      {name && <input type="hidden" name={name} value={value} />}
    </div>
  );
}
