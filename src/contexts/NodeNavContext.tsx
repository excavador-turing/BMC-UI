import { createContext, type ReactNode } from "react";

/**
 * How "open the console for node 3" is expressed, without naming a router.
 *
 * The board interface is one TanStack Router application and the node cards
 * link into it. The fleet cannot be: `src/router.tsx` exports a module-level
 * singleton and registers its type globally, so two independently routed
 * boards are not a thing that can exist. The fleet keeps its own selection in
 * the URL hash instead.
 *
 * Both still need the same buttons on the same cards. So the cards ask for a
 * destination and someone above them decides what that means -- a `<Link>` in
 * the board app, a hash change in the fleet.
 *
 * The default is deliberately a no-op rather than a throw: a component that
 * renders these buttons somewhere neither provider reaches should draw and do
 * nothing, not take the page down.
 */
export type NodeDestination = "console" | "flash-node";

export interface NodeNav {
  /** Where a button for this destination points, or null to render a plain
   *  button and rely on `open`. The board app returns a real href so the
   *  browser's own middle-click and copy-link behaviour keeps working. */
  href(destination: NodeDestination, node: number): string | null;
  /** Go there. Called on click; the board app lets the link do the work. */
  open(destination: NodeDestination, node: number): void;
}

const NOWHERE: NodeNav = {
  href: () => null,
  // Deliberately does nothing. A card rendered outside both providers should
  // draw its buttons and have them do nothing, rather than take the page down
  // on a click.
  open: () => undefined,
};

export const NodeNavContext = createContext<NodeNav>(NOWHERE);

export function NodeNavProvider({
  value,
  children,
}: {
  value: NodeNav;
  children: ReactNode;
}) {
  return (
    <NodeNavContext.Provider value={value}>{children}</NodeNavContext.Provider>
  );
}
