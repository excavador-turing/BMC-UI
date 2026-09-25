import { useEffect, useState } from "react";

import Logo from "@/assets/logo-light.svg?react";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserNav } from "@/components/user-nav";

import { BoardCard } from "./BoardCard";
import { BoardScope } from "./BoardScope";
import { BoardTabs } from "./BoardTabs";
import { EMPTY_CONFIG, type FleetConfig, loadConfig } from "./config";
import { OVERVIEW } from "./route";

/** The switcher's own value for "no board": not a name a board can have. */
const OVERVIEW_TAB = "\u0000overview";
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

  /**
   * What this bundle is, as its image tag.
   *
   * Injected at build time by `Dockerfile.fleet` from the release tag. Absent
   * in a development build, where "dev" is the honest answer -- a version
   * invented locally would be worse than none.
   */
  const version = (import.meta.env.VITE_BMC_UI_VERSION as string) || "dev";

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col p-6">
      {/* The fleet had no mark of its own: no logo, no version, and no
          footer, because it never renders the board's root route. So the one
          page that exists to watch several boards could not say which
          version of itself it was -- and sat two releases behind with
          nothing on screen to show it. */}
      <div className="mb-4 flex items-center gap-3 border-b pb-3">
        <Logo className="size-8 shrink-0 fill-foreground" />
        <span className="text-lg font-medium whitespace-nowrap">
          Turing fleet
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {version}
        </span>
        <div className="ml-auto">
          <UserNav signOutHref="/oauth2/sign_out" name="operator" />
        </div>
      </div>

      <main className="flex-1">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-medium tracking-tight sm:text-2xl">
              {selected ? (selected.name ?? selected.id) : "Every board"}
            </h1>
            {/* The subtitle is orientation, not instruction, and on a phone it
              is three lines of it above the boards. Kept where there is room
              for it. */}
            <p className="hidden text-sm text-muted-foreground sm:block">
              {selected
                ? (selected.note ??
                  "Everything this board's own interface can do.")
                : "Every board this cluster can reach. Each one answers for itself; a board that is down costs you its card and nothing else."}
            </p>
          </div>

          {selected ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                go(OVERVIEW);
              }}
            >
              ← All boards
            </Button>
          ) : null}
        </header>

        {/* The board switcher stays visible inside a board, so moving from one
          board's Nodes tab to another's is one click and not a trip through
          the overview.

          ONE ROW THAT SCROLLS, not a row that wraps. Measured on the demo
          build: at 390px this and the tab bar below wrapped to three and four
          lines, and with the header above them the fleet spent 301px -- more
          than a third of the viewport -- before the first thing anybody came
          to look at. A wrapped row also moves the tab you were about to press
          when a board is added. */}
        {config.boards.length > 1 ? (
          <Tabs
            value={selected?.id ?? OVERVIEW_TAB}
            onValueChange={(next: string) => {
              go(
                next === OVERVIEW_TAB
                  ? OVERVIEW
                  : { board: next, tab: route.tab }
              );
            }}
            className="mb-4 overflow-x-auto pb-1"
          >
            <TabsList>
              <TabsTrigger value={OVERVIEW_TAB}>Overview</TabsTrigger>
              {config.boards.map((board) => (
                <TabsTrigger key={board.id} value={board.id}>
                  {board.name ?? board.id}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : null}

        {error ? (
          <p className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Could not read the fleet&apos;s configuration: {error}. The chart
            writes <code>config.json</code> into the pod; without it this page
            has no list of boards to show.
          </p>
        ) : null}

        {missing ? (
          <p className="mb-4 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-sm text-foreground">
            No board here is called <code>{route.board}</code>. It may have been
            removed from the fleet&apos;s configuration since this link was
            made.
          </p>
        ) : null}

        {loaded && !error && config.boards.length === 0 ? (
          <p className="text-sm text-muted-foreground">
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

      <SiteFooter />
    </div>
  );
}

export default Fleet;
