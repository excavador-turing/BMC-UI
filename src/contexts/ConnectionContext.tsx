import { createContext, type ReactNode } from "react";

import {
  type ConnectionState,
  useBoardReconnect,
} from "@/hooks/useBoardReconnect";

export interface Connection {
  state: ConnectionState;
  elapsed: number;
  cameBackIn: number | null;
  /** Called by the controls that cause a reboot, so the wait can be named. */
  expectReboot: () => void;
}

/**
 * Whether the board is answering, shared by the layout that draws the banner
 * and the buttons that cause the outage.
 *
 * The default is inert on purpose: a control rendered outside this provider --
 * the fleet renders the board's own tabs, and has its own connection story per
 * board -- calls `expectReboot` into a function that does nothing, rather than
 * throwing or putting a board-wide banner over one card in a grid.
 */
export const ConnectionContext = createContext<Connection>({
  state: "ok",
  elapsed: 0,
  cameBackIn: null,
  expectReboot: () => undefined,
});

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const connection = useBoardReconnect();
  return (
    <ConnectionContext.Provider value={connection}>
      {children}
    </ConnectionContext.Provider>
  );
}
