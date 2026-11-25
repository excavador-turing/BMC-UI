import { createLazyFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import InfoNote from "@/components/InfoNote";
import NavLink from "@/components/NavLink";
import NodePicker from "@/components/NodePicker";
import SerialConsole from "@/components/SerialConsole";
import TabView from "@/components/TabView";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type SerialReaderState,
  useNodeInfoQuery,
  useSerialStatusQuery,
} from "@/lib/api/get";
import { effectiveBaud } from "@/lib/consoleSpeed";

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
  const { data: nodeInfo } = useNodeInfoQuery();

  const node = Number.parseInt(selectedNode);
  const readerState = readerStates?.[node];
  // What this node's port runs at. Unknown until the board has answered, and
  // then shown rather than guessed: a node with nothing stored runs at the
  // default, which is the wrong speed for an RK1.
  const info = nodeInfo?.[node];
  const baud = info === undefined ? undefined : effectiveBaud(info.uart_baud);

  return (
    <TabView>
      <Card>
        <CardHeader>
          <CardTitle>{t("console.header")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <NodePicker
            label={t("console.nodeSelect")}
            value={selectedNode}
            onValueChange={setSelectedNode}
            data-testid="console-node"
          />
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                {t("console.readerTask")}
                <InfoNote
                  text={t("console.readerNote")}
                  path="/why/a-console-to-every-module/#reader-running-is-about-the-bmc-not-the-module"
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
              {baud !== undefined && (
                <>
                  <span aria-hidden className="text-muted-foreground">
                    |
                  </span>
                  <span className="text-muted-foreground">
                    {t("nodes.consoleSpeed")}
                  </span>
                  <span className="font-medium" data-testid="console-baud">
                    {t("nodes.baudValue", { baud })}
                    {info?.uart_baud == null
                      ? ` (${t("nodes.baudDefault")})`
                      : ""}
                  </span>
                  <NavLink
                    destination="power-control"
                    node={node + 1}
                    className="text-primary underline underline-offset-4"
                  >
                    {t("console.speedChange")}
                  </NavLink>
                </>
              )}
            </div>
            <SerialConsole key={node} node={node} baud={baud} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          {/* No note of its own: the difference between this writer and the
            terminal is one note, on the terminal, where people type. */}
          <CardTitle>{t("console.restTitle")}</CardTitle>
          <CardDescription>{t("console.restIntro")}</CardDescription>
        </CardHeader>
        <CardContent>
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
          {/* The same console from a shell on the BMC. The speed is a node
              setting, so the tool is not asked for one. */}
          <div className="mt-4 flex flex-col gap-2 text-sm">
            <p>{t("console.localIntro")}</p>
            <code
              className="w-fit rounded-sm bg-muted px-1 font-mono break-all"
              data-testid="console-local-example"
            >
              microcom -s 115200 /dev/ttyNode1
            </code>
            <p>{t("console.localSpeed")}</p>
          </div>
        </CardContent>
      </Card>
    </TabView>
  );
}

/** The routed form: parse `?node=` here, hand it down as a prop. */
function SerialConsoleRoute() {
  const { node } = Route.useSearch();
  return <SerialConsoleTab preselected={node} />;
}
