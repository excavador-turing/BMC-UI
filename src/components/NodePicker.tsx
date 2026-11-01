import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Field, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";

const NODE_INDEXES = [0, 1, 2, 3] as const;

/**
 * Choose one of the four compute modules, in one click.
 *
 * A dropdown made this two clicks (open, then choose) and hid three of the
 * four answers; four short choices belong in the open. This is a real radio
 * group -- `role="radiogroup"` named by its visible label, one tab stop, the
 * arrow keys moving the choice, Space or Enter choosing -- drawn as a row of
 * segments so it reads as a control on a phone as well as on a desk.
 *
 * The value is the node's INDEX as a string ("0".."3"), exactly what the
 * selects it replaces carried, so each page's state and its API calls are
 * unchanged. An empty value means nothing is chosen yet (the USB page, when
 * the board reports no node); a radio group cannot be emptied by clicking,
 * which is the point -- a node is always chosen once one is.
 */
export default function NodePicker({
  label,
  value,
  onValueChange,
  disabled = false,
  className,
  "data-testid": testId,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
}) {
  const { t } = useTranslation();
  const labelId = useId();

  return (
    <Field className={className}>
      <FieldLabel id={labelId}>{label}</FieldLabel>
      <RadioGroup
        aria-labelledby={labelId}
        data-testid={testId}
        data-slot="node-picker"
        value={value === "" ? null : value}
        disabled={disabled}
        onValueChange={(next) => {
          if (typeof next === "string") onValueChange(next);
        }}
        className="grid w-full grid-cols-4 gap-1 rounded-lg border bg-muted p-1 aria-disabled:opacity-50"
      >
        {NODE_INDEXES.map((index) => {
          const itemValue = String(index);
          return (
            <Radio.Root
              key={itemValue}
              value={itemValue}
              nativeButton
              render={<button type="button" />}
              onKeyDown={(event) => {
                // A radio activates on Space alone; Enter is the key people
                // reach for on a button-shaped choice, so it chooses too.
                if (event.key === "Enter" && !disabled) {
                  event.preventDefault();
                  onValueChange(itemValue);
                }
              }}
              className={cn(
                "inline-flex h-8 min-w-0 cursor-pointer items-center justify-center rounded-md px-1 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none select-none hover:text-foreground focus-visible:z-10 focus-visible:ring-3 focus-visible:ring-ring/60 data-checked:bg-primary data-checked:text-primary-foreground data-checked:shadow-sm data-disabled:cursor-not-allowed"
              )}
            >
              <span className="truncate">
                {t("nodes.node", { nodeId: index + 1 })}
              </span>
            </Radio.Root>
          );
        })}
      </RadioGroup>
    </Field>
  );
}
