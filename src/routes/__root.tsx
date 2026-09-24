import "@/globals.css";

import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import { type AuthContext } from "@/contexts/AuthContext";

export interface RouterContext {
  auth: AuthContext;
}

const ReactQueryDevtools = import.meta.env.PROD
  ? () => null // Render nothing in production
  : lazy(() =>
      // Lazy load in development
      import("@tanstack/react-query-devtools").then((res) => ({
        default: res.ReactQueryDevtools,
      }))
    );

const TanStackRouterDevtools = import.meta.env.PROD
  ? () => null // Render nothing in production
  : lazy(() =>
      // Lazy load in development
      import("@tanstack/react-router-devtools").then((res) => ({
        default: res.TanStackRouterDevtools,
      }))
    );

export function RootComponent() {
  return (
    <>
      {/* No footer here: the sidebar is fixed to the side of the window, and
          a footer at this level would run underneath it. Each layout places
          its own. */}
      <div className="flex min-h-svh w-full flex-col antialiased">
        <Outlet />
      </div>
      <Suspense>
        <ReactQueryDevtools />
        <TanStackRouterDevtools initialIsOpen={false} />
      </Suspense>
    </>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});
