/**
 * The one report a failed mutation gets, kept free of React so `npm test`
 * can run it.
 *
 * The query client's `MutationCache` calls this for every mutation that
 * fails. Call sites do not toast errors themselves; their `onError` only puts
 * the screen back (a switch, a dialog). That way a failure is reported once,
 * always with the board's own words, and a call site cannot forget it.
 *
 * A hook's `meta` can shape the report:
 * - `errorTitle`: an i18n key for the title. Default `ui.requestFailed`.
 * - `shownInPlace(error)`: true for an error the page already shows where it
 *   happened (the sign-in form, the switch card's question), so it is not
 *   reported a second time.
 */
import { bmcdMessage } from "./bmcdMessage.ts";

export interface ErrorToast {
  title: string;
  description: string;
  variant: "destructive";
}

export interface ErrorReporter {
  toast: (toast: ErrorToast) => unknown;
  t: (key: string) => string;
  /** The board the toast is about, in a fleet; null on a board's own UI. */
  scope?: string | null;
}

export const DEFAULT_ERROR_TITLE = "ui.requestFailed";

export function reportMutationError(
  error: unknown,
  meta: Record<string, unknown> | undefined,
  { toast, t, scope = null }: ErrorReporter
): void {
  const shownInPlace = meta?.shownInPlace as
    ((error: unknown) => boolean) | undefined;
  if (typeof shownInPlace === "function" && shownInPlace(error)) return;
  const key =
    typeof meta?.errorTitle === "string" && meta.errorTitle !== ""
      ? meta.errorTitle
      : DEFAULT_ERROR_TITLE;
  const title = t(key);
  toast({
    // The same prefix `useToast` gives a toast inside a fleet's board.
    title: scope === null ? title : `${scope}: ${title}`,
    description: error instanceof Error ? bmcdMessage(error) : String(error),
    variant: "destructive",
  });
}
