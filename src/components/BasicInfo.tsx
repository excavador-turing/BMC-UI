import { Suspense } from "react";
import { useTranslation } from "react-i18next";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import { useAboutTabData } from "@/lib/api/get";
import { versionLabel } from "@/lib/format";

/**
 * The board's name and firmware version, at the top of the sidebar on every
 * page. Which board this is and what it is running are how somebody knows
 * they are typing into the right window.
 *
 * `version` is the FIRMWARE release; the daemon's own version is
 * `bmcd_version`. This once said "daemon" and showed the firmware, so the one
 * number people quote in a bug report was under the wrong name on every page.
 *
 * The error boundary is not decoration. This is a `useSuspenseQuery`, it is
 * mounted on every route, and a bare `<Suspense>` does not catch a rejection
 * -- so one failing `type=about` unwound past the sidebar, past the route, and
 * past the root, which has no boundary either, and blanked the entire
 * application. A board whose daemon is briefly busy must cost the sidebar,
 * not the page someone is working on.
 */
export default function BasicInfo() {
  return (
    <ErrorBoundary label="BasicInfo" fallback={<BasicInfoUnavailable />}>
      <Suspense
        fallback={
          <Layout>
            <Skeleton className="h-3 w-24" />
          </Layout>
        }
      >
        <BasicInfoContent />
      </Suspense>
    </ErrorBoundary>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 leading-none">
      <span className="font-medium">Turing Pi</span>
      <span className="truncate text-xs text-muted-foreground">{children}</span>
    </div>
  );
}

function BasicInfoContent() {
  const { data } = useAboutTabData();
  return (
    <Layout>
      {data.hostname} · {versionLabel(data.version)}
    </Layout>
  );
}

function BasicInfoUnavailable() {
  const { t } = useTranslation();
  return <Layout>{t("about.unavailable")}</Layout>;
}
