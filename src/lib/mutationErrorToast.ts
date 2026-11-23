import { MutationCache } from "@tanstack/react-query";
import i18n from "i18next";

import { toast } from "@/hooks/use-toast";
import { reportMutationError } from "@/lib/api/mutationError";

/**
 * The mutation cache every query client is built with. It is the only place
 * a failed mutation is toasted; see `reportMutationError`.
 *
 * `scope` is the board's name in a fleet, so the toast says which board
 * refused -- the prefix `useToast` adds from `ToastScopeContext`, which a
 * cache outside the React tree cannot read.
 */
export function mutationErrorCache(scope: string | null = null) {
  return new MutationCache({
    onError: (error, _variables, _context, mutation) =>
      reportMutationError(error, mutation.meta, {
        toast,
        t: (key) => i18n.t(key),
        scope,
      }),
  });
}
