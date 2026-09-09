import { Suspense } from "react";
import { useTranslation } from "react-i18next";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import BasicInfoSkeleton from "@/components/skeletons/basic-info";
import { useAboutTabData } from "@/lib/api/get";
import { versionLabel } from "@/lib/format";

function BasicInfoContent() {
  const { t } = useTranslation();
  const { data } = useAboutTabData();

  return (
    <div className="flex flex-col">
      <h1 className="text-3xl font-bold">Turing Pi</h1>
      <div className="mt-2 flex flex-row flex-wrap gap-x-4">
        <div className="flex items-center">
          <span className="text-sm font-semibold lowercase opacity-60">
            {t("about.hostname")}
          </span>
          <span className="ml-2 text-sm font-semibold">{data.hostname}</span>
        </div>
        {/* `about.version` is the FIRMWARE release; the daemon's own version
            is `bmcd_version`. This said "daemon" and showed the firmware, so
            the one number people quote in a bug report was under the wrong
            name on every page. */}
        <div className="flex items-center">
          <span className="text-sm font-semibold lowercase opacity-60">
            {t("about.firmware")}
          </span>
          <span className="ml-2 text-sm font-semibold">
            {versionLabel(data.version)}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * The board's name and firmware version, in the header of every page.
 *
 * The error boundary is not decoration. This is a `useSuspenseQuery`, it is
 * mounted on every route, and a bare `<Suspense>` does not catch a rejection
 * -- so one failing `type=about` unwound past the header, past the route, and
 * past the root, which has no boundary either, and blanked the entire
 * application. A board whose daemon is briefly busy must cost the header, not
 * the page someone is working on.
 */
export default function BasicInfo() {
  return (
    <ErrorBoundary label="BasicInfo" fallback={<BasicInfoUnavailable />}>
      <Suspense fallback={BasicInfoSkeleton()}>
        <BasicInfoContent />
      </Suspense>
    </ErrorBoundary>
  );
}

function BasicInfoUnavailable() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col">
      <h1 className="text-3xl font-bold">Turing Pi</h1>
      <div className="mt-2 text-sm font-semibold opacity-60">
        {t("about.unavailable")}
      </div>
    </div>
  );
}
