import { Link, type LinkProps } from "@tanstack/react-router";
import { ArrowRightIcon } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useFlash } from "@/hooks/use-flash";
import { cn } from "@/lib/utils";

/**
 * The tabs, in the order a person moves through them.
 *
 * What you look at first, then the things you act on, then what changes the
 * board, then what identifies it. The old order mixed the two -- Info, Network
 * and About are things you read, while Nodes, Console, USB, Firmware Upgrade
 * and Flash Node are things you do -- and four of those were about the same
 * four objects with no path between them.
 */
const navigationLinks = [
  { to: "/info", label: "navigation.overview" },
  { to: "/nodes", label: "navigation.nodes" },
  { to: "/console", label: "navigation.console" },
  { to: "/network", label: "navigation.network" },
  { to: "/firmware-upgrade", label: "navigation.firmware" },
  { to: "/settings", label: "navigation.settings" },
  { to: "/about", label: "navigation.about" },
] as const;

interface FlashingLinkProps {
  isFlashing: boolean;
}

function MobileLink({
  to,
  children,
  onClick,
  isFlashing,
}: LinkProps &
  FlashingLinkProps & { onClick?: () => void; children: ReactNode }) {
  return (
    <Link
      to={to}
      className={cn(
        "mx-2 flex items-center justify-between text-lg font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200",
        isFlashing && "animate-pulse duration-700"
      )}
      activeProps={{
        className: "text-neutral-900 dark:text-neutral-200",
      }}
      onClick={onClick}
    >
      {children}
      <ArrowRightIcon />
    </Link>
  );
}

/**
 * A tab in the header bar, at `xl` and above.
 *
 * Underlined rather than boxed: the strip version below draws a tab shape,
 * which needs a row of its own and a background to sit on. Inside the header
 * there is no strip to be part of, so the active tab says so with a line
 * under it and everything fits in the 64 px the header already costs.
 */
function InlineTabLink({
  to,
  children,
  isFlashing,
}: LinkProps & FlashingLinkProps) {
  return (
    <Link
      to={to}
      viewTransition
      className={cn(
        "border-b-2 border-transparent px-2 py-1 text-sm font-semibold whitespace-nowrap text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100",
        isFlashing && "animate-pulse duration-700"
      )}
      activeProps={{
        className:
          "border-neutral-900 text-neutral-900 dark:border-neutral-100 dark:text-neutral-100",
      }}
    >
      {children}
    </Link>
  );
}

function TabLink({ to, children, isFlashing }: LinkProps & FlashingLinkProps) {
  return (
    <Link
      to={to}
      viewTransition
      className={cn(
        "w-full py-3.5 text-center text-base font-semibold hover:bg-white dark:hover:bg-neutral-800",
        isFlashing && "animate-pulse duration-700"
      )}
      activeProps={{
        className:
          "border-t-2 border-neutral-300 bg-white outline-hidden dark:border-neutral-700 dark:bg-neutral-900 hover:bg-white dark:hover:bg-neutral-900",
      }}
    >
      {children}
    </Link>
  );
}

export default function NavigationLinks({
  isDesktop,
  inHeader = false,
  onClick,
}: {
  isDesktop: boolean;
  /** Inside the header bar, one row with everything else. */
  inHeader?: boolean;
  onClick?: () => void;
}) {
  const { t } = useTranslation();
  const { flashType, isFlashing } = useFlash();

  const renderInline = useMemo(
    () =>
      navigationLinks.map(({ to, label }) => {
        const isNodeFlashing =
          isFlashing && flashType === "node" && to === "/nodes";
        const isFirmwareFlashing =
          isFlashing && flashType === "firmware" && to === "/firmware-upgrade";

        return (
          <InlineTabLink
            key={to}
            to={to}
            isFlashing={isNodeFlashing || isFirmwareFlashing}
          >
            {t(label)}
          </InlineTabLink>
        );
      }),
    [isFlashing, flashType, t]
  );

  const renderLinks = useMemo(
    () =>
      navigationLinks.map(({ to, label }) => {
        // Flashing a node happens from the Nodes tab now, not from a tab of
        // its own; the pulse follows the work.
        const isNodeFlashing =
          isFlashing && flashType === "node" && to === "/nodes";
        const isFirmwareFlashing =
          isFlashing && flashType === "firmware" && to === "/firmware-upgrade";

        return (
          <TabLink
            key={to}
            to={to}
            isFlashing={isNodeFlashing || isFirmwareFlashing}
          >
            {t(label)}
          </TabLink>
        );
      }),
    [isFlashing, flashType, t]
  );

  const renderMobileLinks = useMemo(
    () =>
      navigationLinks.map(({ to, label }) => {
        // Flashing a node happens from the Nodes tab now, not from a tab of
        // its own; the pulse follows the work.
        const isNodeFlashing =
          isFlashing && flashType === "node" && to === "/nodes";
        const isFirmwareFlashing =
          isFlashing && flashType === "firmware" && to === "/firmware-upgrade";

        return (
          <MobileLink
            key={to}
            to={to}
            onClick={onClick}
            isFlashing={isNodeFlashing || isFirmwareFlashing}
          >
            {t(label)}
          </MobileLink>
        );
      }),
    [isFlashing, flashType, onClick, t]
  );

  if (inHeader)
    return (
      <nav className="flex min-w-0 flex-1 items-center justify-end gap-1 overflow-x-auto">
        {renderInline}
      </nav>
    );

  if (isDesktop)
    return (
      <nav className="hidden justify-around bg-turing-bg md:flex dark:bg-turing-bg-dark">
        {renderLinks}
      </nav>
    );

  return <nav className="flex flex-col gap-5">{renderMobileLinks}</nav>;
}
