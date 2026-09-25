import { type ReactNode, useCallback, useContext } from "react";

import { toast as manager } from "@/components/ui/toast";
import { ToastScopeContext } from "@/contexts/ToastScopeContext";

/**
 * The one way this interface raises a toast.
 *
 * Fifty call sites say `toast({ title, description, variant })`. The toasts
 * themselves are shadcn's Base UI ones now, driven by the manager
 * `ui/toast.tsx` exports; this keeps the call sites' shape so none of them
 * had to change, and keeps the fleet's board prefix in the one place it
 * belongs (see `ToastScopeContext`).
 *
 * How many show at once is the `<Toaster limit>` in `app.tsx`.
 */
interface ToastOptions {
  title?: string;
  description?: ReactNode;
  /** `destructive` is an error: it gets the error icon and colour. */
  variant?: "default" | "destructive";
}

function toast({ title, description, variant }: ToastOptions) {
  const id = manager.add({
    title,
    description,
    type: variant === "destructive" ? "error" : undefined,
  });
  return { id, dismiss: () => manager.close(id) };
}

function useToast() {
  // Which board, if we are inside one. Null on the board interface, where a
  // prefix would only add noise to an unambiguous message.
  const scope = useContext(ToastScopeContext);

  const scoped = useCallback(
    (props: ToastOptions) => {
      if (scope === null) return toast(props);
      const title =
        props.title === undefined ? scope : `${scope}: ${props.title}`;
      return toast({ ...props, title });
    },
    [scope]
  );

  return { toast: scoped };
}

export { toast, useToast };
