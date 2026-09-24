import {
  BookOpenIcon,
  FanIcon,
  HardDriveDownloadIcon,
  InfoIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  NetworkIcon,
  PowerIcon,
  ShieldCheckIcon,
  TerminalIcon,
  UsbIcon,
  WrenchIcon,
} from "lucide-react";
import { type ComponentType, type SVGProps } from "react";

import { GithubIcon } from "@/components/icons/github";

export interface NavPage {
  /** A translation key. */
  title: string;
  url: string;
}

export interface NavItem extends Omit<NavPage, "url"> {
  url?: string;
  /** A lucide icon, or one drawn to match (see `icons/github.tsx`). */
  icon: LucideIcon | ComponentType<SVGProps<SVGSVGElement>>;
  /** Pages that belong to this one, listed beneath it. */
  items?: NavPage[];
  /** Somewhere else entirely, opened in a new tab. */
  external?: boolean;
}

export interface NavSection {
  /**
   * A translation key. Absent for the Dashboard, which stands above the
   * groups.
   */
  title?: string;
  items: NavItem[];
}

/**
 * The pages, grouped by what they are about rather than by when they were
 * written.
 *
 * The **Dashboard** stands above the groups: it is where you land, and it
 * answers "is the board all right" before anything else is asked. **Board**
 * is the machine and what runs on it: the four modules and everything done to
 * one of them, and how it keeps cool.
 * **Network & Access** is how it is reached and who may reach it. **System**
 * is the BMC's own firmware, clock, backups and identity.
 *
 * Two things moved to get there. The fan was on Settings between the clock
 * and the backup, a cooling tool among housekeeping; it is Cooling now. And
 * Settings was the name of a page holding a clock, a backup and a reboot --
 * Maintenance says what those have in common. Its address is still
 * `/settings`, so a bookmark still lands.
 *
 * Flash OS and USB are under Nodes. They were reachable only from a button on
 * a node card, while the fleet listed both as tabs of their own.
 *
 * The sidebar draws this, and the breadcrumb above every page reads it.
 */
export const navigation: NavSection[] = [
  // First and on its own, above every group: where you land.
  {
    items: [
      {
        title: "navigation.dashboard",
        url: "/info",
        icon: LayoutDashboardIcon,
      },
    ],
  },
  {
    title: "navigation.nodes",
    items: [
      {
        title: "navigation.powerControl",
        url: "/power-control",
        icon: PowerIcon,
      },
      { title: "navigation.console", url: "/console", icon: TerminalIcon },
      {
        title: "navigation.flashNode",
        url: "/flash-node",
        icon: HardDriveDownloadIcon,
      },
      { title: "navigation.usb", url: "/usb", icon: UsbIcon },
    ],
  },
  {
    title: "navigation.network",
    items: [
      { title: "navigation.network", url: "/network", icon: NetworkIcon },
    ],
  },
  {
    title: "navigation.sectionSystem",
    items: [
      { title: "navigation.cooling", url: "/cooling", icon: FanIcon },
      {
        title: "navigation.firmware",
        url: "/firmware-upgrade",
        icon: HardDriveDownloadIcon,
      },
      {
        title: "navigation.maintenance",
        url: "/settings",
        icon: WrenchIcon,
      },
      { title: "navigation.security", url: "/security", icon: ShieldCheckIcon },
      { title: "navigation.about", url: "/about", icon: InfoIcon },
    ],
  },
  {
    title: "navigation.sectionOther",
    items: [
      {
        title: "navigation.docs",
        url: "https://turingpi.xyz",
        icon: BookOpenIcon,
        external: true,
      },
      {
        title: "navigation.github",
        url: "https://github.com/excavador-turing",
        icon: GithubIcon,
        external: true,
      },
    ],
  },
];

/**
 * Where a path sits, for the breadcrumb: its section, the page it belongs
 * under if it is a sub-page, and the page itself.
 */
export function trailFor(pathname: string): {
  section: NavSection;
  parent: NavItem | null;
  page: NavPage;
} | null {
  for (const section of navigation) {
    for (const item of section.items) {
      if (item.external) continue;
      if (item.url && item.url === pathname) {
        return { section, parent: null, page: { title: item.title, url: item.url } };
      }
      const child = item.items?.find((sub) => sub.url === pathname);
      if (child) return { section, parent: item, page: child };
    }
  }
  return null;
}

/**
 * Whether a page's entry pulses while a flash runs: the work is started from
 * Nodes or Flash OS for a module, and from Firmware for the BMC.
 */
export function pulses(
  to: string,
  isFlashing: boolean,
  flashType: string | null
) {
  if (!isFlashing) return false;
  return (
    (flashType === "node" &&
      (to === "/power-control" || to === "/flash-node")) ||
    (flashType === "firmware" && to === "/firmware-upgrade")
  );
}
