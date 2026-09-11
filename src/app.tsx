import "@/i18n.ts";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { FlashProvider } from "@/contexts/FlashContext";
import InnerApp from "@/innerApp";
import { type router } from "@/router";

const queryClient = new QueryClient();

// The demo answers from fixtures instead of a board. Vite replaces
// `import.meta.env.VITE_DEMO` at build time, so in a normal build this branch
// is dead code and the fixtures never enter the bundle a board serves.
if (import.meta.env.VITE_DEMO === "1") {
  const { installDemo } = await import("@/demo/install");
  installDemo();
}

// Register your router for maximum type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// The fleet is a different application built from this same tree: one
// interface over every board, served by the cluster rather than by a board.
// It shares the API hooks and the components by import -- sharing by import
// cannot drift, sharing by published version can -- and is selected at build
// time, so the bundle a board serves never carries it.
const isFleet = import.meta.env.VITE_APP === "fleet";

// Render the app
const rootElement = document.getElementById("app")!;
if (isFleet) {
  const { Fleet } = await import("@/fleet/Fleet");
  document.title = "Turing fleet";
  createRoot(rootElement).render(
    <StrictMode>
      <ThemeProvider attribute="class">
        {/*
          The fleet holds no token: Envoy authenticates the operator through
          dex and presents the client certificate on the board leg, so the
          bundle never sees a credential. AuthProvider is still here because
          the shared API hooks read it, and an empty token produces an empty
          Authorization header, which is exactly right for a request whose
          identity is added in front of it.
        */}
        <AuthProvider>
          <Fleet />
        </AuthProvider>
      </ThemeProvider>
    </StrictMode>
  );
} else if (!rootElement.innerHTML) {
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <ThemeProvider attribute="class">
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <FlashProvider>
              <TooltipProvider delayDuration={0}>
                <InnerApp />
                <Toaster />
              </TooltipProvider>
            </FlashProvider>
          </QueryClientProvider>
        </AuthProvider>
      </ThemeProvider>
    </StrictMode>
  );
}
