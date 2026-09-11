import { useContext } from "react";

import { ApiBaseContext } from "@/contexts/ApiBaseContext";

/** Where this subtree's API lives. See ApiBaseContext for why it is a context. */
export function useApiBase() {
  return useContext(ApiBaseContext);
}
