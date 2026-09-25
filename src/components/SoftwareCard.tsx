import { Link } from "@tanstack/react-router";
import TimeAgo from "javascript-time-ago";
import de from "javascript-time-ago/locale/de";
import en from "javascript-time-ago/locale/en";
import es from "javascript-time-ago/locale/es";
import nl from "javascript-time-ago/locale/nl";
import pl from "javascript-time-ago/locale/pl";
import zh from "javascript-time-ago/locale/zh";
import { ArrowUpCircleIcon } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import TableItem from "@/components/TableItem";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAboutTabData, useUpdateCheckQuery } from "@/lib/api/get";
import { EMPTY_VALUE, versionLabel } from "@/lib/format";

import { version as packageVersion } from "../../package.json";

// What this build actually is. vite.config.ts injects the release tag when
// one is known; package.json is upstream's and is not bumped by this fork, so
// on its own it would report every build of ours as upstream's v3.3.7.
declare const __BMC_UI_VERSION__: string | null;
const version = __BMC_UI_VERSION__ ?? packageVersion;

TimeAgo.addDefaultLocale(en);
TimeAgo.addLocale(de);
TimeAgo.addLocale(es);
TimeAgo.addLocale(nl);
TimeAgo.addLocale(pl);
TimeAgo.addLocale(zh);

/**
 * What the board runs. Once the About page; now a card on the Dashboard
 * beside the Board card, which has the hardware and the live readings.
 */
export default function SoftwareCard() {
  const {
    t,
    i18n: { language },
  } = useTranslation();
  const { data } = useAboutTabData();
  const update = useUpdateCheckQuery();

  const timeAgo = useMemo(() => new TimeAgo(language), [language]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("about.software")}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col">
          <TableItem term={t("about.firmwareVersion")}>
            <span className="inline-flex items-center gap-1.5 font-medium">
              {versionLabel(data.version)}
              {/* A newer stable release, by the daemon's own check -- the
                  same one the Firmware tile and page read. */}
              {update.data?.stable?.update_available && (
                <Link
                  to="/firmware-upgrade"
                  title={t("dashboard.attnUpdate", {
                    version: update.data.stable.target,
                  })}
                  aria-label={t("dashboard.attnUpdate", {
                    version: update.data.stable.target,
                  })}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ArrowUpCircleIcon className="size-4" />
                </Link>
              )}
            </span>
          </TableItem>
          <TableItem term={t("about.daemonVersion")}>
            {data.bmcd_version ? versionLabel(data.bmcd_version) : EMPTY_VALUE}
          </TableItem>
          {/* The one field an operator wants after a kernel bump. Older daemons
          never sent it, so an absent value renders as absent rather than
          as an empty row. */}
          <TableItem term={t("about.kernel")}>
            {data.kernel ?? EMPTY_VALUE}
          </TableItem>
          <TableItem term={t("about.buildTime")}>
            {data.buildtime.toLocaleString()} (
            {timeAgo.format(new Date(data.buildtime))})
          </TableItem>
          {/* Ordinarily the same string as the daemon version, and a row
              that repeats the one above it teaches nothing. Shown when they
              differ, which is what a hand-built daemon looks like. */}
          {data.build_version !== data.bmcd_version && (
            <TableItem term={t("about.buildVersion")}>
              {versionLabel(data.build_version)}
            </TableItem>
          )}
          <TableItem term={t("about.buildrootRelease")}>
            {data.buildroot}
          </TableItem>
          <TableItem term={t("about.apiVersion")}>
            {versionLabel(data.api)}
          </TableItem>
          <TableItem term={t("about.bmcUI")}>{versionLabel(version)}</TableItem>
        </dl>
      </CardContent>
    </Card>
  );
}
