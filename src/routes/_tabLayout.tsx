import {
  createFileRoute,
  Outlet,
  redirect,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { AppSidebar } from "@/components/app-sidebar";
import ConnectionBanner from "@/components/ConnectionBanner";
import FactoryPasswordGate from "@/components/FactoryPasswordGate";
import SiteFooter from "@/components/SiteFooter";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ConnectionProvider } from "@/contexts/ConnectionContext";
import {
  type NodeDestination,
  NodeNavProvider,
} from "@/contexts/NodeNavContext";
import { trailFor } from "@/lib/navigation";

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
        {/* A board still on the password it shipped with shows one page and
            nothing else -- not the sidebar, not a banner over it. The daemon
            refuses everything but the change anyway, so the pages would
            render as a wall of errors. */}
        <FactoryPasswordGate>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              {/* Above the page, full width: an outage is not a property of
                  the page you happen to be on. */}
              <ConnectionBanner />
              <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
                <SidebarTrigger className="-ml-1" />
                <Separator
                  orientation="vertical"
                  className="mr-2 data-vertical:h-4 data-vertical:self-auto"
                />
                <Trail />
              </header>
              <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-4 md:p-6">
                <Outlet />
              </div>
              <SiteFooter />
            </SidebarInset>
          </SidebarProvider>
        </FactoryPasswordGate>
      </ConnectionProvider>
    </NodeNavProvider>
  );
}

/** Section › page, from the same list the sidebar draws. */
function Trail() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const trail = trailFor(pathname);
  if (!trail) return null;
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem className="hidden md:block">
          {t(trail.section)}
        </BreadcrumbItem>
        <BreadcrumbSeparator className="hidden md:block" />
        <BreadcrumbItem>
          <BreadcrumbPage>{t(trail.page)}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
