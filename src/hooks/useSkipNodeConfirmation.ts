import { useCallback, useSyncExternalStore } from "react";

import { useApiBase } from "@/hooks/useApiBase";

/**
 * "Don't ask again", scoped to the board it was agreed for.
 *
 * It used to be one key for everything. In a fleet that means dismissing the
 * confirmation on one board silences it on all of them -- a setting about
 * cutting power to compute modules, applied to machines the operator never
 * agreed to. The base URL is what distinguishes a board here, since it is
 * what every request already goes to.
 */
function powerConfirmationKey(base: string) {
  return base === "/api"
    ? "skipNodeConfirmation"
    : `skipNodeConfirmation:${base}`;
}

/**
 * Fired in this tab when the answer changes: `storage` only fires in the
 * others.
 */
const CHANGED = "skip-node-confirmation";

/**
 * Whether power and restart still ask first, for this board.
 *
 * One store, read by every switch and button that asks: the Nodes page's
 * power switch and restart, and the Dashboard's switches. Ticking the box in
 * one dialog is heard by all of them at once, not at the next reload.
 */
export function useSkipNodeConfirmation(): [boolean, () => void] {
  const { base } = useApiBase();
  const key = powerConfirmationKey(base);

  const subscribe = useCallback((onChange: () => void) => {
    window.addEventListener("storage", onChange);
    window.addEventListener(CHANGED, onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener(CHANGED, onChange);
    };
  }, []);

  const skip = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(key) === "true",
    () => false
  );

  const remember = useCallback(() => {
    localStorage.setItem(key, "true");
    window.dispatchEvent(new Event(CHANGED));
  }, [key]);

  return [skip, remember];
}
