import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { UserNav } from "@/components/user-nav";

import { BoardCard } from "./BoardCard";
import { BoardScope } from "./BoardScope";
import { BoardTabs } from "./BoardTabs";
import { EMPTY_CONFIG, type FleetConfig, loadConfig } from "./config";
import { OVERVIEW } from "./route";
import { useFleetRoute } from "./useFleetRoute";

/**
 * Every board, and everything you can do to one.
 *
 * Two views, one hash apart. The overview answers "is anything wrong" across
 * the estate; picking a board gives you that board's whole interface -- the
 * same Nodes, Console, Firmware and Settings tabs the board serves itself,
 * rendered from the same components against that board's API.
 *
 * The pod holds no credential and runs no server code: this is a static
 * bundle, and the browser fans out to each board through Envoy, which presents
 * the client certificate on the board leg and forwards the operator's
 * identity. A compromise of this bundle yields nothing the operator's own
 * session did not already allow -- which is what makes it safe to give this
 * page real controls rather than a read-only view.
 */
export function Fleet() {
  const [config, setConfig] = useState<FleetConfig>(EMPTY_CONFIG);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [route, go] = useFleetRoute();

  useEffect(() => {
    let live = true;
    loadConfig()
      .then((c) => live && setConfig(c))
      .catch(
        (e: unknown) =>
          live && setError(e instanceof Error ? e.message : String(e))
      )
      .finally(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, []);

  const selected = route.board
    ? (config.boards.find((b) => b.id === route.board) ?? null)
    : null;

  // A hash naming a board the configuration does not list. Says so rather than
  // silently showing the overview, because the usual cause is a board that was
  // removed and a link that was not.
  const missing = route.board !== null && loaded && selected === null;

  return (
    <main className="mx-auto max-w-7xl p-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {selected ? (selected.name ?? selected.id) : "Turing fleet"}
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {selected
              ? (selected.note ??
                "Everything this board's own interface can do.")
              : "Every board this cluster can reach. Each one answers for itself; a board that is down costs you its card and nothing else."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selected ? (
            <Button
              size="sm"
              variant="bw"
              onClick={() => {
                go(OVERVIEW);
              }}
            >
              ← All boards
            </Button>
          ) : null}
          {/* The proxy's sign-out, not the board's: this bundle holds no
              token to drop, and the session belongs to dex. */}
          <UserNav signOutHref="/oauth2/sign_out" name="operator" />
        </div>
      </header>

      {/* The board switcher stays visible inside a board, so moving from one
          board's Nodes tab to another's is one click and not a trip through
          the overview. */}
      {config.boards.length > 1 ? (
        <nav className="mb-6 flex flex-wrap gap-1">
          <Button
            size="sm"
            variant={selected ? "bw" : "turing-green"}
            onClick={() => {
              go(OVERVIEW);
            }}
          >
            Overview
          </Button>
          {config.boards.map((board) => (
            <Button
              key={board.id}
              size="sm"
              variant={selected?.id === board.id ? "turing-green" : "bw"}
              onClick={() => {
                go({ board: board.id, tab: route.tab });
              }}
            >
              {board.name ?? board.id}
            </Button>
          ))}
        </nav>
      ) : null}

      {error ? (
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-200">
          Could not read the fleet&apos;s configuration: {error}. The chart
          writes <code>config.json</code> into the pod; without it this page has
          no list of boards to show.
        </p>
      ) : null}

      {missing ? (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          No board here is called <code>{route.board}</code>. It may have been
          removed from the fleet&apos;s configuration since this link was made.
        </p>
      ) : null}

      {loaded && !error && config.boards.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          The configuration lists no boards.
        </p>
      ) : null}

      {selected ? (
        // Keyed by board so switching boards tears the whole subtree down.
        // Every provider under here is per board, including the cache and the
        // flash state machine; carrying either across would show one board's
        // answers under another board's name.
        <BoardScope key={selected.id} board={selected}>
          <BoardTabs board={selected} route={route} go={go} />
        </BoardScope>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {config.boards.map((board) => (
            <BoardCard
              key={board.id}
              board={board}
              range={config.supportedBmcd}
              onOpen={() => {
                go({ board: board.id, tab: "" });
              }}
            />
          ))}
        </div>
      )}
    </main>
  );
}

export default Fleet;
