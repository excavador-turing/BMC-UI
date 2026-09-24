import { createLazyFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import InfoNote from "@/components/InfoNote";
import SerialConsole from "@/components/SerialConsole";
import TabView from "@/components/TabView";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type SerialReaderState, useSerialStatusQuery } from "@/lib/api/get";

export const Route = createLazyFileRoute("/_tabLayout/console")({
  component: SerialConsoleRoute,
  errorComponent: () => <div>Error loading Console</div>,
});

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
    return <span className="font-medium">{t("console.readerRunning")}</span>;
  }

  if (state === "Initialized") {
    return (
      <span className="font-medium text-warning">
        {t("console.readerInitialized")}
      </span>
    );
  }

  if (state === "Stopped") {
    return (
      <span className="font-medium text-destructive">
        {t("console.readerStopped")}
      </span>
    );
  }

  return <span className="font-medium">{state}</span>;
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
  const nodeItems = [0, 1, 2, 3].map((nodeIndex) => ({
    value: String(nodeIndex),
    label: t("nodes.node", { nodeId: nodeIndex + 1 }),
  }));

  return (
    <TabView title={t("console.header")}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end gap-4 border-b pb-4">
          <Select
            items={nodeItems}
            value={selectedNode}
            onValueChange={(value) => {
              if (value !== null) setSelectedNode(value);
            }}
          >
            <SelectTrigger
              aria-label={t("console.nodeSelect")}
              className="w-36"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {nodeItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {t("console.nodeSelect")}
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              {t("console.readerTask")}
              <InfoNote
                text={t("console.readerNote")}
                path="/features/a-console-to-every-module/#reader-running-is-about-the-bmc-not-the-module"
                label={t("console.readerTask")}
              />
            </span>
            <span aria-hidden className="text-muted-foreground">
              |
            </span>
            {isError ? (
              <span className="text-muted-foreground">
                {t("console.readerUnavailable")}
              </span>
            ) : readerState === undefined ? (
              <span className="text-muted-foreground">
                {t("console.readerUnknown")}
              </span>
            ) : (
              <ReaderState state={readerState} />
            )}
          </div>
          <SerialConsole key={node} node={node} />
        </div>

        <section className="flex flex-col gap-4 border-t pt-6">
          <h3 className="flex items-center gap-2 text-lg font-medium">
            {t("console.restTitle")}
            <InfoNote
              text={t("console.restCrlf")}
              path="/features/a-console-to-every-module/#two-ways-to-type-and-they-are-not-the-same"
              label={t("console.restTitle")}
            />
          </h3>
          <p>{t("console.restIntro")}</p>
          <ul className="flex flex-col gap-2 text-sm">
            <li>
              <code className="rounded-sm bg-muted px-1 font-mono break-all">
                GET /api/bmc?opt=get&amp;type=uart&amp;node=&lt;0..3&gt;
              </code>{" "}
              — {t("console.restRead")}
            </li>
            <li>
              <code className="rounded-sm bg-muted px-1 font-mono break-all">
                POST
                /api/bmc?opt=set&amp;type=uart&amp;node=&lt;0..3&gt;&amp;cmd=&lt;text&gt;
              </code>{" "}
              — {t("console.restWrite")}
            </li>
          </ul>
        </section>
      </div>
    </TabView>
  );
}

/** The routed form: parse `?node=` here, hand it down as a prop. */
function SerialConsoleRoute() {
  const { node } = Route.useSearch();
  return <SerialConsoleTab preselected={node} />;
}
