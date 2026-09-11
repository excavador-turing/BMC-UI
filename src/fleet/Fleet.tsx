import { useEffect, useState } from "react";

import { BoardCard } from "./BoardCard";
import { EMPTY_CONFIG, type FleetConfig, loadConfig } from "./config";

/**
 * Every board on one page.
 *
 * The pod holds no credential and runs no server code: this is a static
 * bundle, and the browser fans out to each board through Envoy, which is what
 * presents the client certificate on the board leg and forwards the operator's
 * identity. So a compromise of this bundle yields nothing that the operator's
 * own session did not already allow.
 */
export function Fleet() {
  const [config, setConfig] = useState<FleetConfig>(EMPTY_CONFIG);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

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

  return (
    <main className="mx-auto max-w-7xl p-6">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Turing fleet</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Every board this cluster can reach. Each one answers for itself; a
          board that is down costs you its card and nothing else.
        </p>
      </header>

      {error ? (
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-200">
          Could not read the fleet's configuration: {error}. The chart writes
          <code> config.json</code> into the pod; without it this page has no
          list of boards to show.
        </p>
      ) : null}

      {loaded && !error && config.boards.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          The configuration lists no boards.
        </p>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {config.boards.map((board) => (
          <BoardCard
            key={board.id}
            board={board}
            range={config.supportedBmcd}
          />
        ))}
      </div>
    </main>
  );
}

export default Fleet;
