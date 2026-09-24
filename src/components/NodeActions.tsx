import {
  HardDriveDownload,
  MoreHorizontalIcon,
  TerminalSquare,
  Usb,
} from "lucide-react";
import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { type NodeDestination } from "@/contexts/NodeNavContext";
import { useNodeNav } from "@/hooks/useNodeNav";

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

  return (
    <NavigationMenu className="flex-none">
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger
            aria-label={t("nodes.moreActions")}
            title={t("nodes.moreActions")}
            className="size-8 p-0 [&>svg:last-child]:hidden"
          >
            <MoreHorizontalIcon />
          </NavigationMenuTrigger>
          <NavigationMenuContent className="w-64">
            <ul className="grid gap-1 p-2">
              <NodeLink destination="console" node={nodeId}>
                <TerminalSquare data-icon="inline-start" />
                {t("nodes.openConsole")}
              </NodeLink>

              <NodeLink destination="flash-node" node={nodeId}>
                <HardDriveDownload data-icon="inline-start" />
                {t("nodes.flashNode")}
              </NodeLink>

              <NodeLink destination="usb" node={nodeId}>
                <Usb data-icon="inline-start" />
                {t("navigation.usb")}
              </NodeLink>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
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
  "aria-label": ariaLabel,
}: {
  destination: NodeDestination;
  node?: number;
  children: ReactNode;
  "aria-label"?: string;
}) {
  const nav = useNodeNav();
  const href = nav.href(destination, node);

  if (href) {
    return (
      <li>
        <NavigationMenuLink
          aria-label={ariaLabel}
          className="p-2"
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
        </NavigationMenuLink>
      </li>
    );
  }

  return (
    <li>
      <NavigationMenuLink
        aria-label={ariaLabel}
        className="p-2"
        onClick={() => {
          nav.open(destination, node);
        }}
      >
        {children}
      </NavigationMenuLink>
    </li>
  );
}
