import { useContext } from "react";

import { NodeNavContext } from "@/contexts/NodeNavContext";

/** Where the per-node buttons go. See `NodeNavContext` for why this is not
 *  simply a router link. */
export function useNodeNav() {
  return useContext(NodeNavContext);
}
