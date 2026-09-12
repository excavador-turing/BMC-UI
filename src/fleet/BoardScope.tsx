import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useMemo, useState } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { ApiBaseProvider } from "@/contexts/ApiBaseContext";
import { FlashProvider } from "@/contexts/FlashContext";
import {
  type NodeDestination,
  NodeNavProvider,
} from "@/contexts/NodeNavContext";
import { apiBaseFor, type FleetBoard } from "@/fleet/config";
import { toHash } from "@/fleet/route";

/** A cache of its own per board. See `BoardScope` for why. */
export function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/**
 * Everything one board needs above it, so the board application's own tab
 * components work unchanged inside a fleet.
 *
 * Four providers, each for a reason that only shows up with more than one
 * board:
 *
 * `QueryClientProvider` -- its OWN client. The shared hooks use global query
 * keys (`["health"]`, not `["health", board]`) because on a board there is
 * only ever one board. Under a single client every card would show the first
 * board's answers and a mutation on one would invalidate the others. A client
 * per board is also what you want on the merits: these are different machines.
 *
 * `ApiBaseProvider` -- where the requests go, `/boards/<id>/api`, and what a
 * 401 means. `"ignore"`, because one board refusing is that board's problem
 * and must not sign the operator out of the other seven.
 *
 * `FlashProvider` -- a single-board state machine holding one `isFlashing` and
 * one progress bar. Per board, inside that board's client, or two boards
 * cannot be flashed at once and the second one's progress overwrites the
 * first's.
 *
 * `NodeNavProvider` -- what the per-node Console and Flash buttons mean here:
 * a hash change within this board, not a route in an application that is not
 * running.
 */
export function BoardScope({
  board,
  children,
  client,
}: {
  board: FleetBoard;
  children: ReactNode;
  /** Supply one to control resets from outside; otherwise one is made here. */
  client?: QueryClient;
}) {
  const [own] = useState(makeClient);
  const active = client ?? own;

  const apiBase = useMemo(
    () => ({
      base: apiBaseFor(board),
      unauthorized: "ignore" as const,
      // Nothing here holds a board credential, by design: the pod is a static
      // bundle, and Envoy in front of it authenticates the operator through
      // dex and presents a client certificate on the leg to the board.
      identity: "gateway" as const,
    }),
    [board]
  );

  const nav = useMemo(
    () => ({
      href: (destination: NodeDestination, node: number) =>
        toHash({ board: board.id, tab: destination, node }),
      open: (destination: NodeDestination, node: number) => {
        window.location.hash = toHash({
          board: board.id,
          tab: destination,
          node,
        });
      },
    }),
    [board.id]
  );

  return (
    <QueryClientProvider client={active}>
      <ApiBaseProvider value={apiBase}>
        <NodeNavProvider value={nav}>
          <FlashProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </FlashProvider>
        </NodeNavProvider>
      </ApiBaseProvider>
    </QueryClientProvider>
  );
}
