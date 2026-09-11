import { HardDriveDownload, TerminalSquare, Usb } from "lucide-react";
import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type NodeDestination } from "@/contexts/NodeNavContext";
import { useToast } from "@/hooks/use-toast";
import { useNodeNav } from "@/hooks/useNodeNav";
import { useUSBTabData } from "@/lib/api/get";
import { useUSBModeMutation } from "@/lib/api/set";

/**
 * What you can do to one node, on the page that lists the nodes.
 *
 * Nodes, Console, USB and Flash Node were four tabs about the same four
 * objects with no path between them: someone looking at node 2 could not get
 * to node 2's console, and Flash Node had no idea what the USB page had set.
 * These three controls close that, and the two tabs leave the bar.
 *
 * The USB selector is deliberately not a per-node setting even though it sits
 * on a node's card. The board has **one** bus and it can be routed to one node
 * at a time, so choosing here moves it — which is why the current holder is
 * named on every other card rather than left for someone to discover.
 */
export default function NodeActions({ nodeId }: { nodeId: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const usb = useUSBTabData();
  const setMode = useUSBModeMutation();

  // "Node 3" -> 3. The daemon reports the holder by label, and the node ids in
  // this component are 1-based while the API takes 0-based.
  const holder = Number.parseInt(usb.data.node.replace(/\D/g, ""), 10);
  const isHolder = holder === nodeId;
  const mode = usb.data.mode;

  const change = (next: string) => {
    setMode.mutate(
      { node: nodeId - 1, mode: Number.parseInt(next, 10) },
      {
        onSuccess: () =>
          toast({
            title: t("usb.changeSuccessTitle"),
            description: t("nodes.usbRouted", { nodeId }),
          }),
        onError: (e) =>
          toast({
            title: t("usb.changeFailedTitle"),
            description: e.message,
            variant: "destructive",
          }),
      }
    );
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <NodeLink destination="console" node={nodeId}>
        <TerminalSquare className="mr-2 size-4" />
        {t("nodes.openConsole")}
      </NodeLink>

      <NodeLink destination="flash-node" node={nodeId}>
        <HardDriveDownload className="mr-2 size-4" />
        {t("nodes.flashNode")}
      </NodeLink>

      <div className="flex items-center gap-2">
        <Usb className="size-4 opacity-60" aria-hidden />
        <Select
          value={isHolder ? String(usbModeValue(mode)) : ""}
          onValueChange={change}
          disabled={setMode.isPending}
        >
          <SelectTrigger
            hideLabel
            className="w-44"
            label={t("nodes.usbRouteLabel", { nodeId })}
          >
            <SelectValue placeholder={t("nodes.usbNotRouted")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">{t("usb.mode.host")}</SelectItem>
            <SelectItem value="1">{t("usb.mode.device")}</SelectItem>
            <SelectItem value="2">{t("usb.mode.flash")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* One bus, one holder. Saying which node has it on every card that does
          not is the difference between a control that looks broken and one
          that explains itself. */}
      {!isHolder && (
        <span className="text-sm opacity-60">
          {t("nodes.usbHeldBy", { nodeId: holder })}
        </span>
      )}
    </div>
  );
}

function usbModeValue(mode: "Host" | "Device" | "Flash") {
  switch (mode) {
    case "Host":
      return 0;
    case "Device":
      return 1;
    case "Flash":
      return 2;
  }
}

/**
 * One of the two per-node buttons that leave this card.
 *
 * Renders an anchor when whoever is above can name an address, so
 * middle-click, copy-link and the browser's own history keep working; a plain
 * button when it cannot. The board app names one; the fleet names a hash.
 */
function NodeLink({
  destination,
  node,
  children,
}: {
  destination: NodeDestination;
  node: number;
  children: ReactNode;
}) {
  const nav = useNodeNav();
  const href = nav.href(destination, node);

  if (href) {
    return (
      <Button asChild variant="bw" size="sm">
        <a
          href={href}
          onClick={(event) => {
            // Let the browser handle the gestures that mean "somewhere else":
            // a new tab is a new tab, and intercepting it is rude.
            if (
              event.defaultPrevented ||
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.button !== 0
            ) {
              return;
            }
            event.preventDefault();
            nav.open(destination, node);
          }}
        >
          {children}
        </a>
      </Button>
    );
  }

  return (
    <Button
      variant="bw"
      size="sm"
      onClick={() => {
        nav.open(destination, node);
      }}
    >
      {children}
    </Button>
  );
}
