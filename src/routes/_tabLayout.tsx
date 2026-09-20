import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { useMemo } from "react";

import ConnectionBanner from "@/components/ConnectionBanner";
import Header from "@/components/header";
import NavigationLinks from "@/components/navigation-links";
import { ConnectionProvider } from "@/contexts/ConnectionContext";
import {
  type NodeDestination,
  NodeNavProvider,
} from "@/contexts/NodeNavContext";
import { useMediaQuery } from "@/hooks/use-media-query";

export const Route = createFileRoute("/_tabLayout")({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      redirect({
        to: "/login",
        search: {
          redirect: location.href,
        },
        throw: true,
      });
    }
    return {};
  },
  component: AppLayoutComponent,
});

export function AppLayoutComponent() {
  const navigate = useNavigate();
  // At `xl` the tabs are in the header bar. Rendering the strip here as well
  // would be the same seven links twice.
  const isWide = useMediaQuery("(min-width: 1280px)");

  // What "open the console for node 3" means HERE: a route in this
  // application. The fleet answers the same question with a hash change. The
  // node cards ask and do not care which.
  const nav = useMemo(
    () => ({
      href: (destination: NodeDestination, node: number) =>
        `/${destination}?node=${String(node)}`,
      open: (destination: NodeDestination, node: number) => {
        void navigate({ to: `/${destination}`, search: { node } });
      },
    }),
    [navigate]
  );

  return (
    <NodeNavProvider value={nav}>
      <ConnectionProvider>
        <div className="flex w-full flex-col items-center justify-center">
          {/* Above the header, full width: an outage is not a property of the
              tab you happen to be on. */}
          <ConnectionBanner />
          <Header />

          <main className="w-full overflow-hidden border border-neutral-300 bg-white shadow-sm xl:w-300 dark:border-neutral-700 dark:bg-neutral-900">
            {!isWide && <NavigationLinks isDesktop />}
            <div className="px-3 py-6 md:p-12">
              <Outlet />
            </div>
          </main>
        </div>
      </ConnectionProvider>
    </NodeNavProvider>
  );
}
