import { createLazyFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import InfoNote from "@/components/InfoNote";
import SerialConsole from "@/components/SerialConsole";
import TabView from "@/components/TabView";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type SerialReaderState, useSerialStatusQuery } from "@/lib/api/get";

export const Route = createLazyFileRoute("/_tabLayout/console")({
  component: SerialConsoleRoute,
  errorComponent: () => <div>Error loading Console</div>,
});

/** The four module bays, addressed the way the daemon addresses them: 0..3. */
const nodeValues = ["0", "1", "2", "3"] as const;

/**
 * The reader task's state, in words.
 *
 * The three states bmcd is known to send are translated. Anything else is
 * printed verbatim rather than dropped or mapped to a default: a state this
 * interface has not heard of is exactly the thing somebody debugging needs
 * to see.
 */
function ReaderState({ state }: { state: SerialReaderState }) {
  const { t } = useTranslation();

  if (state === "Running") {
    return <span className="font-semibold">{t("console.readerRunning")}</span>;
  }

  if (state === "Initialized") {
    return (
      <span className="font-semibold text-amber-600 dark:text-amber-500">
        {t("console.readerInitialized")}
      </span>
    );
  }

  if (state === "Stopped") {
    return (
      <span className="font-semibold text-red-600 dark:text-red-400">
        {t("console.readerStopped")}
      </span>
    );
  }

  return <span className="font-semibold">{state}</span>;
}

/**
 * A serial console for each compute module.
 *
 * The interface could power a module on and flash it and never show a line
 * of what it printed. A module that fails before the network comes up -- a
 * bad image, a wrong device tree, a kernel panic -- is invisible from here,
 * and the only recourse was the serial header on the board itself.
 *
 * One terminal at a time, selected by module and mounted with `key={node}`,
 * so switching modules disposes the terminal and closes the socket rather
 * than leaving either behind.
 *
 * `preselected` rather than a router search read, because the fleet renders
 * this component directly with no router above it and `Route.useSearch()`
 * throws there. The route wrapper below passes the parsed `?node=`.
 */
export function SerialConsoleTab({ preselected }: { preselected?: number }) {
  const { t } = useTranslation();
  // `?node=2`, so a node card on the Nodes tab can open that node's console
  // rather than dropping you on node 1 to choose again. The search is
  // validated in console.tsx and is absent for a plain visit.
  const { node: fromLink } = { node: preselected };
  const [selectedNode, setSelectedNode] = useState<string>(
    fromLink ? String(fromLink - 1) : "0"
  );
  const { data: readerStates, isError } = useSerialStatusQuery();

  const node = Number.parseInt(selectedNode);
  const readerState = readerStates?.[node];

  return (
    <TabView title={t("console.header")}>
      <div className="space-y-4">
        <Select
          name="node"
          value={selectedNode}
          onValueChange={(value) => setSelectedNode(value)}
        >
          <SelectTrigger label={t("console.nodeSelect")}>
            <SelectValue placeholder={t("ui.selectPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {nodeValues.map((value) => (
              <SelectItem key={value} value={value}>
                {t("nodes.node", { nodeId: Number.parseInt(value) + 1 })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex flex-wrap items-baseline gap-3">
          <span className="inline-flex items-center gap-1 text-sm font-semibold opacity-60">
            {t("console.readerTask")}
            <InfoNote
              text={t("console.readerNote")}
              path="/features/a-console-to-every-module/#reader-running-is-about-the-bmc-not-the-module"
              label={t("console.readerTask")}
            />
          </span>
          {isError ? (
            <span className="text-sm opacity-60">
              {t("console.readerUnavailable")}
            </span>
          ) : readerState === undefined ? (
            <span className="text-sm opacity-60">
              {t("console.readerUnknown")}
            </span>
          ) : (
            <ReaderState state={readerState} />
          )}
        </div>
      </div>

      <SerialConsole key={node} node={node} />

      <div>
        <div className="mb-6 flex items-center gap-2 text-lg font-bold">
          {t("console.restTitle")}
          <InfoNote
            text={t("console.restCrlf")}
            path="/features/a-console-to-every-module/#two-ways-to-type-and-they-are-not-the-same"
            label={t("console.restTitle")}
          />
        </div>
        <div className="space-y-2 text-sm">
          <p>{t("console.restIntro")}</p>
          <ul className="space-y-1">
            <li>
              <code className="rounded-xs bg-turing-bg px-1 break-all dark:bg-turing-bg-dark">
                GET /api/bmc?opt=get&amp;type=uart&amp;node=&lt;0..3&gt;
              </code>{" "}
              — {t("console.restRead")}
            </li>
            <li>
              <code className="rounded-xs bg-turing-bg px-1 break-all dark:bg-turing-bg-dark">
                POST
                /api/bmc?opt=set&amp;type=uart&amp;node=&lt;0..3&gt;&amp;cmd=&lt;text&gt;
              </code>{" "}
              — {t("console.restWrite")}
            </li>
          </ul>
        </div>
      </div>
    </TabView>
  );
}

/** The routed form: parse `?node=` here, hand it down as a prop. */
function SerialConsoleRoute() {
  const { node } = Route.useSearch();
  return <SerialConsoleTab preselected={node} />;
}
