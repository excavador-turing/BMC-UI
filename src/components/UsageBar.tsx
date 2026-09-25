import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { type ReactNode } from "react";

import { ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/**
 * How full something is, and how much of it, in words: memory, storage, an
 * upload. shadcn's `Progress` parts with the amount written beside the bar.
 *
 * `warningOnHigh` colours a nearly-full bar -- amber from 75 %, red from 90 %
 * -- which is right for a disk and wrong for an upload, where full is the
 * point. `pulsing` says the work is still going when the number alone cannot:
 * a flash sits at 100 % while the board writes what it received.
 */
export default function UsageBar({
  value,
  label,
  warningOnHigh = false,
  pulsing = false,
  className,
  "aria-label": ariaLabel,
}: {
  value: number;
  label?: ReactNode;
  warningOnHigh?: boolean;
  pulsing?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const level = !warningOnHigh
    ? null
    : value >= 90
      ? "bg-destructive"
      : value >= 75
        ? "bg-warning"
        : null;

  return (
    <ProgressPrimitive.Root
      value={value}
      aria-label={ariaLabel}
      data-slot="progress"
      className={cn("flex flex-col gap-1.5", className)}
    >
      {label && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {label}
        </span>
      )}
      <ProgressTrack className="h-2">
        <ProgressIndicator
          className={cn(level, pulsing && "animate-pulse duration-700")}
        />
      </ProgressTrack>
    </ProgressPrimitive.Root>
  );
}
