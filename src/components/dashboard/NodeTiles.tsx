import { Link } from "@tanstack/react-router";
import { PowerIcon, PowerOffIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useDurationLabel } from "@/hooks/use-duration";
import {
  type NodeInfoResponse,
  type SwitchPort,
  useNodesTabData,
  useSwitchPortsQuery,
} from "@/lib/api/get";
import { isReading } from "@/lib/format";

/**
 * The four modules, one card each, as dashboard-01's section cards lay them
 * out: which node, its name, whether it is on, and when that last changed.
 *
 * "When it last changed" is only as good as what the daemon says.
 * `power_on_time` is elapsed seconds since the module was powered on -- see
 * `NodeLiveness` for why it is not an epoch stamp -- so a node that is on has
 * a real answer. A node that is off has none: the daemon keeps no time for
 * the power going off, and the card says so rather than inventing one.
 */
export default function NodeTiles() {
  const { data: nodes } = useNodesTabData();
  const { data: ports } = useSwitchPortsQuery();

  return (
    <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {nodes.map((node, index) => (
        <NodeTile
          key={index}
          nodeId={index + 1}
          node={node}
          port={ports?.find((p) => p.name === `node${String(index + 1)}`)}
        />
      ))}
    </div>
  );
}

function NodeTile({
  nodeId,
  node,
  port,
}: {
  nodeId: number;
  node: NodeInfoResponse;
  port: SwitchPort | undefined;
}) {
  const { t } = useTranslation();
  const duration = useDurationLabel();
  const on = node.power_on_time !== null;
  const since = on ? duration(node.power_on_time ?? 0) : null;

  const link = !port
    ? null
    : !port.present
      ? t("nodes.linkAbsent")
      : port.link
        ? isReading(port.speed_mbps)
          ? `${t("nodes.linkUp")} · ${t("nodes.linkSpeed", { speed: port.speed_mbps })}`
          : t("nodes.linkUp")
        : t("nodes.linkDown");

  return (
    <Link
      to="/power-control"
      className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className="@container/card h-full transition-colors hover:bg-muted/40">
        <CardHeader>
          <CardDescription>{t("nodes.node", { nodeId })}</CardDescription>
          <CardTitle
            className={
              node.name
                ? "truncate text-2xl font-semibold"
                : "truncate text-2xl font-semibold text-muted-foreground"
            }
          >
            {node.name ?? t("dashboard.unnamed")}
          </CardTitle>
          <CardAction>
            {on ? (
              <Badge variant="success">
                <PowerIcon />
                {t("dashboard.stateOn")}
              </Badge>
            ) : (
              <Badge variant="secondary">
                <PowerOffIcon />
                {t("dashboard.stateOff")}
              </Badge>
            )}
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 border-none bg-transparent pt-0 text-sm">
          <div className="line-clamp-1 font-medium">
            {on
              ? since === null
                ? t("nodes.powerOnUnreadable")
                : t("dashboard.poweredOnAgo", { duration: since })
              : t("dashboard.offSinceUnknown")}
          </div>
          {link && (
            <div className="line-clamp-1 text-muted-foreground">{link}</div>
          )}
        </CardFooter>
      </Card>
    </Link>
  );
}
