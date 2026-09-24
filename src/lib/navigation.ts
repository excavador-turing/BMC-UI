/**
 * The pages, in the order a person moves through them, in three groups: the
 * board and what runs on it, how it is reached and secured, and the board's
 * own firmware and identity.
 *
 * What you look at first, then the things you act on, then what changes the
 * board, then what identifies it. The old order mixed the two -- Info, Network
 * and About are things you read, while Nodes, Console, USB, Firmware Upgrade
 * and Flash Node are things you do -- and four of those were about the same
 * four objects with no path between them.
 *
 * The sidebar draws this, and the breadcrumb above every page reads it to say
 * where you are. `hidden` pages are not in the sidebar -- they are reached
 * from a node's actions -- but still need a place in the breadcrumb.
 */
export const navigation = [
  {
    title: "navigation.sectionBoard",
    items: [
      { to: "/info", label: "navigation.overview" },
      { to: "/nodes", label: "navigation.nodes" },
      { to: "/console", label: "navigation.console" },
    ],
    hidden: [
      { to: "/flash-node", label: "navigation.flashNode" },
      { to: "/usb", label: "navigation.usb" },
    ],
  },
  {
    title: "navigation.sectionConfiguration",
    items: [
      { to: "/network", label: "navigation.network" },
      { to: "/security", label: "navigation.security" },
      { to: "/settings", label: "navigation.settings" },
    ],
    hidden: [],
  },
  {
    title: "navigation.sectionSystem",
    items: [
      { to: "/firmware-upgrade", label: "navigation.firmware" },
      { to: "/about", label: "navigation.about" },
    ],
    hidden: [],
  },
] as const;

/** The section and page a path belongs to, for the breadcrumb. */
export function trailFor(pathname: string) {
  for (const section of navigation) {
    const pages: readonly { to: string; label: string }[] = [
      ...section.items,
      ...section.hidden,
    ];
    const page = pages.find((item) => item.to === pathname);
    if (page) return { section: section.title, page: page.label };
  }
  return null;
}

/**
 * Whether a page's entry pulses: flashing a node happens from the Nodes page,
 * not a page of its own, and the pulse follows the work.
 */
export function pulses(
  to: string,
  isFlashing: boolean,
  flashType: string | null
) {
  if (!isFlashing) return false;
  return (
    (flashType === "node" && to === "/nodes") ||
    (flashType === "firmware" && to === "/firmware-upgrade")
  );
}
