import { createContext, type ReactNode } from "react";

/**
 * Where the API this subtree talks to lives, and what a 401 from it means.
 *
 * The board's own interface is served BY the board, so "/api" on the same
 * origin is right and a 401 means the session expired -- log out. The fleet
 * interface is served by the cluster and talks to several boards through
 * Envoy at `/boards/<id>/api`, where a 401 from one board is that board's
 * problem and must not sign the operator out of the other seven.
 *
 * Defaulting to the board's answer keeps every existing caller unchanged: a
 * tree with no provider behaves exactly as it did before this existed.
 */
export interface ApiBase {
  /** Prefix for every request. The hooks append "/bmc/...". */
  base: string;
  /** What a 401 means here. */
  unauthorized: "logout" | "ignore";
  /**
   * Who proves who the operator is.
   *
   * `"session"` -- this page logged in to the board and holds a token from
   * it. Requests carry it; the console puts it in a WebSocket subprotocol,
   * because a browser cannot set a header on a handshake.
   *
   * `"gateway"` -- nothing here holds a board credential and nothing should.
   * The fleet is reached through Envoy, which authenticates the operator with
   * dex and then opens its own connection to the board holding a client
   * certificate the board trusts, naming the operator in a header. A browser
   * cannot forge that and does not need to: the identity is attached on the
   * hop the browser is not part of.
   *
   * The distinction is load-bearing for the console and nowhere else. Every
   * other tab sends an empty `Authorization` header and is answered anyway;
   * the console REFUSED TO OPEN ITS SOCKET AT ALL without a token, which is
   * why the fleet's console said "there is no session token" while the same
   * board answered every other request on the same page.
   */
  identity: "session" | "gateway";
}

export const DEFAULT_API_BASE: ApiBase = {
  base: "/api",
  unauthorized: "logout",
  identity: "session",
};

export const ApiBaseContext = createContext<ApiBase>(DEFAULT_API_BASE);

export const ApiBaseProvider: React.FC<{
  value: ApiBase;
  children: ReactNode;
}> = ({ value, children }) => (
  <ApiBaseContext.Provider value={value}>{children}</ApiBaseContext.Provider>
);
