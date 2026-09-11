import { type ComponentType, lazy, type LazyExoticComponent } from "react";

/**
 * The board application's tabs, as the fleet renders them.
 *
 * Every one of these is the SAME component the board interface uses, imported
 * from its route file rather than reimplemented. That is the point of the
 * exercise: a control that exists once behaves identically in both places and
 * cannot drift into a worse copy.
 *
 * The lazy wrappers are built HERE, at module scope, and not inside a render.
 * `lazy()` returns a new component type each time it is called, and a new type
 * means React unmounts and remounts the subtree -- so building them per render
 * would reset every tab's state on every keystroke. Cheap to get wrong and
 * invisible until someone types into a form.
 *
 * Loaded lazily for the same reason the board's own routes are: a fleet
 * showing eight cards has no business parsing the firmware upgrade page.
 */
export interface FleetTab {
  /** Path segment in the hash. */
  id: string;
  /** What to call it in the tab bar. */
  label: string;
  /** Takes `?node=`; the two that do get it passed through. */
  takesNode?: boolean;
  Component: LazyExoticComponent<ComponentType<{ preselected?: number }>>;
}

type Preselectable = ComponentType<{ preselected?: number }>;

/** `lazy()` over a named export rather than a default one, since the board's
 *  route files export their component by name beside the route itself. */
function named(
  load: () => Promise<Record<string, unknown>>,
  name: string
): LazyExoticComponent<Preselectable> {
  return lazy(async () => {
    const module = await load();
    return { default: module[name] as Preselectable };
  });
}

export const FLEET_TABS: FleetTab[] = [
  {
    id: "nodes",
    label: "Nodes",
    Component: named(
      () => import("@/routes/_tabLayout/nodes.lazy"),
      "NodesTab"
    ),
  },
  {
    id: "console",
    label: "Console",
    takesNode: true,
    Component: named(
      () => import("@/routes/_tabLayout/console.lazy"),
      "SerialConsoleTab"
    ),
  },
  {
    id: "flash-node",
    label: "Flash a module",
    takesNode: true,
    Component: named(
      () => import("@/routes/_tabLayout/flash-node.lazy"),
      "FlashNode"
    ),
  },
  {
    id: "usb",
    label: "USB",
    Component: named(() => import("@/routes/_tabLayout/usb.lazy"), "USB"),
  },
  {
    id: "info",
    label: "Overview",
    Component: named(() => import("@/routes/_tabLayout/info.lazy"), "Info"),
  },
  {
    id: "network",
    label: "Network",
    Component: named(
      () => import("@/routes/_tabLayout/network.lazy"),
      "Network"
    ),
  },
  {
    id: "firmware-upgrade",
    label: "Firmware",
    Component: named(
      () => import("@/routes/_tabLayout/firmware-upgrade.lazy"),
      "FirmwareUpgrade"
    ),
  },
  {
    id: "settings",
    label: "Settings",
    Component: named(
      () => import("@/routes/_tabLayout/settings.lazy"),
      "Settings"
    ),
  },
  {
    id: "about",
    label: "About",
    Component: named(() => import("@/routes/_tabLayout/about.lazy"), "About"),
  },
];

export const DEFAULT_TAB = FLEET_TABS[0].id;

export function findTab(id: string): FleetTab {
  return FLEET_TABS.find((tab) => tab.id === id) ?? FLEET_TABS[0];
}
