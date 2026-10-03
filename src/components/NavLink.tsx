import { type ReactNode } from "react";

import { type NodeDestination } from "@/contexts/NodeNavContext";
import { useNodeNav } from "@/hooks/useNodeNav";

/**
 * A link to another page of the same board, for components the fleet shares.
 *
 * A TanStack `<Link>` needs the board application's router above it and
 * throws without one, which is what the fleet is. This asks `NodeNavContext`
 * where the destination is and lets the board (a route) or the fleet (a hash
 * within the same board) answer. Where neither provides one it renders a
 * button that does nothing rather than take the page down.
 */
export default function NavLink({
  destination,
  node,
  className,
  title,
  "aria-label": ariaLabel,
  children,
}: {
  destination: NodeDestination;
  node?: number;
  className?: string;
  title?: string;
  "aria-label"?: string;
  children: ReactNode;
}) {
  const nav = useNodeNav();
  const href = nav.href(destination, node);

  if (href) {
    return (
      <a
        href={href}
        title={title}
        aria-label={ariaLabel}
        className={className}
        onClick={(event) => {
          // A new tab is a new tab: leave the gestures that mean "somewhere
          // else" to the browser.
          if (
            event.defaultPrevented ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.button !== 0
          ) {
            return;
          }
          event.preventDefault();
          nav.open(destination, node);
        }}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel}
      className={className}
      onClick={() => {
        nav.open(destination, node);
      }}
    >
      {children}
    </button>
  );
}
