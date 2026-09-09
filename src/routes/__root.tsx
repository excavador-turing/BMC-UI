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
      import("@tanstack/router-devtools").then((res) => ({
        default: res.TanStackRouterDevtools,
      }))
    );

export function RootComponent() {
  return (
    <>
      <div className="flex min-h-screen w-full flex-col justify-between bg-turing-bg text-neutral-900 antialiased transition-all dark:bg-turing-bg-dark dark:text-neutral-100">
        <Outlet />
        {/* Upstream's notice stays: BMC-UI is GPL-2.0 and the attribution is
            required. The fork's is added beside it, because nothing in this
            interface said which one it was -- a screenshot in a bug report
            was indistinguishable from upstream's. */}
        <footer className="flex flex-wrap justify-center gap-x-2 gap-y-1 py-4 text-center text-xs uppercase opacity-60">
          <span>© Turing Machines Inc.</span>
          <span aria-hidden>·</span>
          <span>
            fork © Oleg Tsarev{" "}
            <a className="underline" href="mailto:oleg@tsarev.id">
              oleg@tsarev.id
            </a>
          </span>
          <span aria-hidden>·</span>
          <a
            className="underline"
            href="https://github.com/excavador-turing"
            target="_blank"
            rel="noreferrer noopener"
          >
            excavador-turing
          </a>
          <span aria-hidden>·</span>
          <a
            className="underline"
            href="https://turing.excavador.xyz"
            target="_blank"
            rel="noreferrer noopener"
          >
            docs
          </a>
        </footer>
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
