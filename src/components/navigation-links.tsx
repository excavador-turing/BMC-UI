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
  onClick,
}: {
  isDesktop: boolean;
  onClick?: () => void;
}) {
  const { t } = useTranslation();
  const { flashType, isFlashing } = useFlash();

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

  if (isDesktop)
    return (
      <nav className="hidden justify-around bg-turing-bg md:flex dark:bg-turing-bg-dark">
        {renderLinks}
      </nav>
    );

  return <nav className="flex flex-col gap-5">{renderMobileLinks}</nav>;
}
