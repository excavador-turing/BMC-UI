import { type ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/**
 * A `Button` that says it is working.
 *
 * shadcn's button has no loading state; its answer is a `Spinner` in front of
 * the label and `disabled`, which is what this does. The label stays, so the
 * button does not change width while a request is out, and it cannot be
 * pressed twice.
 */
export default function LoadingButton({
  isLoading = false,
  disabled,
  children,
  ...props
}: ComponentProps<typeof Button> & { isLoading?: boolean }) {
  return (
    <Button disabled={isLoading || disabled} {...props}>
      {isLoading && <Spinner data-icon="inline-start" />}
      {children}
    </Button>
  );
}
