import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, useState } from "react";

import ErrorBoundary from "@/components/ErrorBoundary";
import { ApiBaseProvider } from "@/contexts/ApiBaseContext";
import {
  useAboutTabData,
  useFirmwareSlotsQuery,
  useHealthQuery,
  useNodesTabData,
  useSwitchPortsQuery,
} from "@/lib/api/get";

import {
  apiBaseFor,
  type FleetBoard,
  type FleetConfig,
  outOfRange,
} from "./config";

/** A cache of its own per board. See BoardCard for why. */
function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

interface Props {
  board: FleetBoard;
  range: FleetConfig["supportedBmcd"];
}

/**
 * One board on the overview.
 *
 * Each board gets its OWN QueryClient. The hooks are shared with the board
 * interface and their query keys are global -- `["health"]`, not
 * `["health", board]` -- because on a board there is only ever one board.
 * Rendering them several times under one client would serve every card the
 * first board's answers. A client per card gives each its own cache without
 * touching nineteen hooks, and cache isolation is what we actually want:
 * these are different machines that happen to share a shape.
 */
export function BoardCard({ board, range }: Props) {
  // A board that was down and came back has to be re-asked, and the point of
  // the retry is a cache that does not remember the failure -- so a retry
  // means a NEW client, not an invalidation. The key remounts the boundary,
  // which is the only way to clear a React error boundary.
  const [attempt, setAttempt] = useState(0);
  const [client, setClient] = useState(makeClient);

  const retry = () => {
    setClient(makeClient());
    setAttempt((n) => n + 1);
  };

  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
      <QueryClientProvider client={client}>
        <ApiBaseProvider
          value={{ base: apiBaseFor(board), unauthorized: "ignore" }}
        >
          <ErrorBoundary
            key={attempt}
            label={`board:${board.id}`}
            fallback={<Unreachable board={board} onRetry={retry} />}
          >
            <Suspense fallback={<Reaching board={board} />}>
              <BoardBody board={board} range={range} />
            </Suspense>
          </ErrorBoundary>
        </ApiBaseProvider>
      </QueryClientProvider>
    </div>
  );
}

function Title({ board, sub }: { board: FleetBoard; sub?: string }) {
  return (
    <div>
      <h2 className="text-base font-bold">{board.name ?? board.id}</h2>
      {sub ? (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">{sub}</p>
      ) : null}
    </div>
  );
}

function Reaching({ board }: { board: FleetBoard }) {
  return <Title board={board} sub="reaching it…" />;
}

function Unreachable({
  board,
  onRetry,
}: {
  board: FleetBoard;
  onRetry: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <Title
        board={board}
        sub="did not answer. It may be rebooting, or off the management network."
      />
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 rounded-full border-2 border-neutral-900 px-3 py-1 text-xs font-semibold dark:border-neutral-200"
      >
        Try again
      </button>
    </div>
  );
}

function BoardBody({ board, range }: Props) {
  // Suspense queries: these three decide whether the card can render at all.
  const { data: about } = useAboutTabData();
  // node_info, not type=power. The board's own Nodes page derives power from
  // `power_on_time !== null` and nothing reads `type=power` at all -- whose
  // declared shape is also wrong (the daemon wraps the result in an array),
  // which is invisible precisely because it has no consumer. Following the
  // page that works is better than being the first caller of a hook nobody
  // has exercised.
  const { data: nodes } = useNodesTabData();
  // The rest are allowed to be missing -- an older daemon simply does not
  // serve them, and a card that refuses to draw because one panel is absent
  // would make the fleet less useful than the board it is summarising.
  const health = useHealthQuery();
  const ports = useSwitchPortsQuery();
  const slots = useFirmwareSlotsQuery();

  const bmcd = about.bmcd_version ?? null;
  const warning = outOfRange(bmcd, range);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Title board={board} sub={board.note ?? about.hostname} />
        <div className="text-xs text-neutral-500 dark:text-neutral-400">
          firmware{" "}
          <b className="text-neutral-900 dark:text-neutral-100">
            {about.version ?? "—"}
          </b>
          {bmcd ? <> · bmcd {bmcd}</> : null}
        </div>
      </div>

      {warning ? (
        <p className="rounded border border-amber-400 bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {warning}. Readings may be incomplete; nothing here is a lie, but some
          of it may be absent.
        </p>
      ) : null}

      <div className="grid grid-cols-4 gap-2">
        {nodes.map((node, i) => {
          const on = node.power_on_time != null;
          const port = ports.data?.find((p) => p.name === `node${i + 1}`);
          return (
            <div
              key={i}
              className="rounded border border-neutral-200 px-2 py-1 text-xs dark:border-neutral-700"
            >
              <div className="font-semibold">Node {i + 1}</div>
              <div
                className={
                  on ? "text-lime-700 dark:text-lime-400" : "text-neutral-400"
                }
              >
                {on ? `on ${formatUptime(node.power_on_time)}` : "off"}
              </div>
              <div className="text-neutral-500 dark:text-neutral-400">
                {portWord(port)}
              </div>
            </div>
          );
        })}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
        <Fact
          label="uptime"
          value={formatUptime(health.data?.uptime_seconds)}
        />
        <Fact
          label="clock"
          value={clockWord(health.data?.clock?.synchronised)}
        />
        <Fact label="running slot" value={slotWord(slots.data?.running)} />
        <Fact
          label="rollback image"
          value={slotWord(slots.data?.rollback, "none")}
        />
        <Fact
          label="staged"
          value={
            slots.data?.update_staged ? stagedWord(slots.data.staged) : "—"
          }
        />
        <Fact
          label="last promotion"
          value={promotionWord(slots.data?.last_promotion)}
        />
      </dl>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-neutral-500 dark:text-neutral-400">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function formatUptime(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h} h ${m} m` : `${m} m`;
}

function clockWord(synchronised: boolean | null | undefined): string {
  if (synchronised == null) return "—";
  return synchronised ? "synchronised" : "not synchronised";
}

/** What a switch port is doing, in the words the board itself uses. */
function portWord(
  port:
    | { link?: boolean | null; speed_mbps?: number | null; present?: boolean }
    | undefined
): string {
  if (!port) return "—";
  if (port.present === false) return "no port";
  if (port.link == null) return "—";
  if (!port.link) return "link down";
  return port.speed_mbps ? `${port.speed_mbps} Mb/s` : "link up";
}

/**
 * A slot, named the way an operator would name it.
 *
 * The daemon reports a slot as an object -- which UBI volume, and the version
 * in it when the image was named well enough to tell. An older daemon answers
 * with a bare string. Both are handled, because the fleet talks to boards on
 * different firmware by design and neither shape is wrong.
 */
function slotWord(
  slot:
    string | { volume?: string; version?: string | null } | null | undefined,
  absent = "\u2014"
): string {
  if (slot == null) return absent;
  if (typeof slot === "string") return slot;
  return slot.version ?? slot.volume ?? absent;
}

/** What waits in the staging volume: its version, or failing that its file. */
function stagedWord(
  staged:
    | string
    | { version?: string | null; file?: string | null }
    | null
    | undefined
): string {
  if (staged == null) return "yes";
  if (typeof staged === "string") return staged;
  return staged.version ?? staged.file ?? "yes";
}

/** The gate's last decision, dated. */
function promotionWord(
  promotion:
    string | { message?: string; timestamp?: string } | null | undefined
): string {
  if (promotion == null) return "\u2014";
  if (typeof promotion === "string") return promotion;
  const when = promotion.timestamp
    ? new Date(promotion.timestamp).toLocaleString()
    : null;
  return [promotion.message, when].filter(Boolean).join(" \u00b7 ") || "\u2014";
}
