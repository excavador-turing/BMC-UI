import { useContext } from "react";

import { ConnectionContext } from "@/contexts/ConnectionContext";

/** Whether the board is answering. See ConnectionContext. */
export function useConnection() {
  return useContext(ConnectionContext);
}
