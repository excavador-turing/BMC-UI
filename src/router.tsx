import { createHashHistory, createRouter } from "@tanstack/react-router";

import FourOhFour from "@/components/404";
import { routeTree } from "@/routeTree.gen";

// Create a new router instance
export const router = createRouter({
  routeTree,
  // The demo lives under a subpath on a static host with no SPA fallback --
  // GitHub Pages -- where a direct load of /demo/fork/info is a 404 page, not
  // this app. Hash history sidesteps that: /demo/fork/#/info is always the
  // same index.html, on any host. Only the demo; a board serves this bundle
  // from "/" with the daemon behind it, and its URLs stay as they are.
  ...(import.meta.env.VITE_DEMO === "1"
    ? { history: createHashHistory() }
    : {}),
  defaultPreload: "intent",
  defaultNotFoundComponent: FourOhFour,
  context: {
    auth: undefined!, // This will be set after we wrap the app in an AuthProvider
  },
});
