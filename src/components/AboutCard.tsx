import TimeAgo from "javascript-time-ago";
import de from "javascript-time-ago/locale/de";
import en from "javascript-time-ago/locale/en";
import es from "javascript-time-ago/locale/es";
import nl from "javascript-time-ago/locale/nl";
import pl from "javascript-time-ago/locale/pl";
import zh from "javascript-time-ago/locale/zh";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import TableItem from "@/components/TableItem";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAboutTabData } from "@/lib/api/get";
import { eepromLabel, EMPTY_VALUE, versionLabel } from "@/lib/format";

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
 * What this board and its software are. Once a page of its own, now a card
 * on the Dashboard beside Board info.
 *
 * The firmware version is not repeated here: Board info already shows it,
 * with the update hint beside it.
 */
export default function AboutCard() {
  const {
    t,
    i18n: { language },
  } = useTranslation();
  const { data } = useAboutTabData();

  const timeAgo = useMemo(() => new TimeAgo(language), [language]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("navigation.about")}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col">
          <TableItem term={t("about.boardModel")}>
            {eepromLabel(data.board_model)} ({versionLabel(data.board_revision)}
            )
          </TableItem>
          <TableItem term={t("about.boardSerial")}>
            {eepromLabel(data.board_serial)}
          </TableItem>
          <TableItem term={t("about.hostname")}>{data.hostname}</TableItem>
          <TableItem term={t("about.daemonVersion")}>
            {data.bmcd_version ? versionLabel(data.bmcd_version) : EMPTY_VALUE}
          </TableItem>
          <TableItem term={t("about.buildTime")}>
            {data.buildtime.toLocaleString()} (
            {timeAgo.format(new Date(data.buildtime))})
          </TableItem>
          {/* Ordinarily the same string as the daemon version, and a row that
          repeats the one above it teaches nothing. Shown when they differ,
          which is what a hand-built daemon looks like. */}
          {data.build_version !== data.bmcd_version && (
            <TableItem term={t("about.buildVersion")}>
              {versionLabel(data.build_version)}
            </TableItem>
          )}
          <TableItem term={t("about.buildrootRelease")}>
            {data.buildroot}
          </TableItem>
          {/* The one field an operator wants after a kernel bump. Older daemons
          never sent it, so an absent value renders as absent rather than
          as an empty row. */}
          <TableItem term={t("about.kernel")}>
            {data.kernel ?? EMPTY_VALUE}
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
