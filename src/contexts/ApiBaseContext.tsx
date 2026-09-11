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
}

export const DEFAULT_API_BASE: ApiBase = {
  base: "/api",
  unauthorized: "logout",
};

export const ApiBaseContext = createContext<ApiBase>(DEFAULT_API_BASE);

export const ApiBaseProvider: React.FC<{
  value: ApiBase;
  children: ReactNode;
}> = ({ value, children }) => (
  <ApiBaseContext.Provider value={value}>{children}</ApiBaseContext.Provider>
);
