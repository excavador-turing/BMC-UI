import { useCallback, useEffect, useState } from "react";

import { type FleetRoute, parseHash, toHash } from "@/fleet/route";

/**
 * The fleet's current position, and how to change it.
 *
 * Reads `location.hash` and follows `hashchange`, so the back button and a
 * pasted link both work without a router. Assigning the hash rather than
 * pushing state is deliberate: the browser records the entry itself, and
 * anything fancier would need history management the fleet does not have.
 */
export function useFleetRoute(): [FleetRoute, (next: FleetRoute) => void] {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash));
    };
    window.addEventListener("hashchange", onChange);
    return () => {
      window.removeEventListener("hashchange", onChange);
    };
  }, []);

  const go = useCallback((next: FleetRoute) => {
    const hash = toHash(next);
    if (window.location.hash === hash) return;
    window.location.hash = hash;
  }, []);

  return [route, go];
}
