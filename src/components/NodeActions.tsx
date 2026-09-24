import { HardDriveDownload, TerminalSquare, Usb } from "lucide-react";
import { type ComponentProps, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
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

  const change = (next: string | null) => {
    if (next === null) return;
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

  const usbItems = [
    { value: "0", label: t("usb.mode.host") },
    { value: "1", label: t("usb.mode.device") },
    { value: "2", label: t("usb.mode.flash") },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <NodeLink destination="console" node={nodeId}>
        <TerminalSquare data-icon="inline-start" />
        {t("nodes.openConsole")}
      </NodeLink>

      <NodeLink destination="flash-node" node={nodeId}>
        <HardDriveDownload data-icon="inline-start" />
        {t("nodes.flashNode")}
      </NodeLink>

      <div className="flex items-center gap-2">
        <Usb className="size-4 text-muted-foreground" aria-hidden />
        <Select
          items={usbItems}
          value={isHolder ? String(usbModeValue(mode)) : null}
          onValueChange={change}
          disabled={setMode.isPending}
        >
          <SelectTrigger
            size="sm"
            className="w-44"
            aria-label={t("nodes.usbRouteLabel", { nodeId })}
          >
            <SelectValue placeholder={t("nodes.usbNotRouted")} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {usbItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* One bus, one holder. Saying which node has it on every card that does
          not is the difference between a control that looks broken and one
          that explains itself. */}
      {!isHolder && (
        <span className="text-sm text-muted-foreground">
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
  variant = "outline",
  size = "sm",
  "aria-label": ariaLabel,
}: {
  destination: NodeDestination;
  node: number;
  children: ReactNode;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  "aria-label"?: string;
}) {
  const nav = useNodeNav();
  const href = nav.href(destination, node);

  if (href) {
    return (
      <Button
        variant={variant}
        size={size}
        aria-label={ariaLabel}
        nativeButton={false}
        render={
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
          />
        }
      >
        {children}
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      aria-label={ariaLabel}
      onClick={() => {
        nav.open(destination, node);
      }}
    >
      {children}
    </Button>
  );
}
