import { filesize } from "filesize";
import { CircleCheckIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import CopyButton from "@/components/CopyButton";
import TableItem from "@/components/TableItem";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import UsageBar from "@/components/UsageBar";
import { useDurationLabel } from "@/hooks/use-duration";
import {
  type HealthClock,
  type HealthLoad,
  type HealthMemory,
  type HealthNand,
  useAboutTabData,
  useAddressQuery,
  useHealthQuery,
  useInfoTabData,
  useThermalQuery,
} from "@/lib/api/get";
import {
  eepromLabel,
  EMPTY_VALUE,
  isReading,
  versionLabel,
} from "@/lib/format";
import { hottestReading } from "@/lib/thermal";

const human = (bytes: number) => filesize(bytes, { standard: "jedec" });

/** What a section that reported `present: false` renders as. */
function Absent() {
  const { t } = useTranslation();

  return (
    <span className="font-medium text-warning">{t("info.healthAbsent")}</span>
  );
}

/**
 * The three load averages, in the order every other tool prints them.
 *
 * Formatted to two decimals here rather than trusted: a daemon that sends an
 * integer 0 for an idle board should still read `0.00`, in line with the two
 * numbers beside it, and one that sends something that is not a number at all
 * should not print `NaN`.
 */
function LoadReading({ load }: { load: HealthLoad }) {
  const values = [load.one_minute, load.five_minutes, load.fifteen_minutes];
  // `filter` rather than `some`, so the readings are narrowed to numbers for
  // the render below instead of merely checked here.
  const readings = values.filter(isReading);
  if (!load.present || readings.length !== values.length) {
    return <Absent />;
  }

  return (
    <div className="flex flex-wrap justify-end gap-x-3 lg:justify-start">
      <span className="font-medium">
        {readings.map((value) => value.toFixed(2)).join(" · ")}
      </span>
    </div>
  );
}

/**
 * Memory, as the bar the storage section already uses.
 *
 * The bar is `total - available`, not `total - free`: `available` is the
 * kernel's own estimate of what a new allocation could get, and on a board
 * with 116 MB of RAM the difference between the two is most of the answer to
 * "will this firmware upload fit". `free` is printed beside it because it is
 * the number `/proc/meminfo` readers expect to see, not because it is the one
 * to act on.
 *
 * `warningOnHigh` is the Progress component's own 75/90 colouring, the same
 * behaviour user storage has had all along. It is not a threshold invented
 * here.
 */
function MemoryReading({ memory }: { memory: HealthMemory }) {
  const { t } = useTranslation();

  const total = memory.total_bytes;
  const available = memory.available_bytes;
  if (
    !memory.present ||
    !isReading(total) ||
    total <= 0 ||
    !isReading(available)
  ) {
    return <Absent />;
  }

  const used = Math.max(total - available, 0);

  return (
    <UsageBar
      aria-label={t("info.ariaMemoryUtilization")}
      value={Math.round((used / total) * 100)}
      label={`${human(used)} / ${human(total)}`}
      warningOnHigh
    />
  );
}

/**
 * NAND, as the space left on it. Bad eraseblocks are named only when there
 * are some -- that is the one detail worth an operator's attention here.
 */
function NandReading({ nand }: { nand: HealthNand }) {
  const { t } = useTranslation();

  if (!nand.present) return <Absent />;

  const free = isReading(nand.available_bytes)
    ? t("info.healthNandFreeBytes", { size: human(nand.available_bytes) })
    : isReading(nand.available_eraseblocks) && isReading(nand.total_eraseblocks)
      ? t("info.healthNandFree", {
          available: nand.available_eraseblocks,
          total: nand.total_eraseblocks,
        })
      : null;
  if (free === null) return <Absent />;

  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      <span className="font-medium">{free}</span>
      {isReading(nand.bad_eraseblocks) && nand.bad_eraseblocks > 0 && (
        <span className="text-warning">
          {t("info.healthNandBad", { blocks: nand.bad_eraseblocks })}
        </span>
      )}
    </span>
  );
}

/** The user storage volumes, one row each, in the order the daemon lists them. */
function StorageRows() {
  const { t } = useTranslation();
  const { data } = useInfoTabData();

  return data.storage.map((storage) => {
    const used = Math.max(storage.total_bytes - storage.bytes_free, 0);
    return (
      <TableItem
        key={storage.name}
        term={storage.name === "BMC" ? t("info.bmcStorage") : storage.name}
      >
        <UsageBar
          aria-label={t("info.ariaStorageUtilization")}
          value={Math.round((used / storage.total_bytes) * 100)}
          label={`${human(used)} / ${human(storage.total_bytes)}`}
          warningOnHigh
        />
      </TableItem>
    );
  });
}

/**
 * The board's own time, ticking: this browser's clock plus the offset the
 * daemon measured. Shown so a clock that is wrong reads as wrong at a glance,
 * not only as "not synchronised".
 */
function BoardTime({ offsetSeconds }: { offsetSeconds: number }) {
  const {
    t,
    i18n: { language },
  } = useTranslation();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const time = new Date(now + offsetSeconds * 1000).toLocaleString(language);

  return (
    <span className="text-muted-foreground">
      {t("about.boardTime", { time })}
    </span>
  );
}

/** Whether the clock is synchronised: yes, no, or the daemon cannot say. */
function ClockReading({ clock }: { clock: HealthClock }) {
  const { t } = useTranslation();

  const state =
    clock.synchronised === true ? (
      <span className="inline-flex items-center gap-1.5 font-medium">
        <CircleCheckIcon className="size-4" />
        {t("info.healthClockSynced")}
      </span>
    ) : clock.synchronised === false ? (
      <span className="inline-flex items-center gap-1.5 font-medium text-warning">
        <TriangleAlertIcon className="size-4" />
        {t("info.healthClockNotSynced")}
      </span>
    ) : (
      <span className="text-muted-foreground">
        {t("info.healthClockUnknown")}
      </span>
    );

  return (
    <span className="inline-flex flex-wrap items-baseline justify-end gap-x-2 lg:justify-start">
      {state}
      {isReading(clock.offset_seconds) && (
        <BoardTime offsetSeconds={clock.offset_seconds} />
      )}
    </span>
  );
}

function HealthSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="flex flex-row py-1">
          <div className="w-1/2 lg:w-1/4">
            <Skeleton className="h-6 w-20" />
          </div>
          <Skeleton className="h-6 w-40" />
        </div>
      ))}
    </div>
  );
}

/**
 * How the BMC itself is doing.
 *
 * The Info page reported the user storage volume, the fan, the addresses and
 * the switch, and nothing at all about the computer serving the page. That
 * board has **116 MB of RAM**, and a firmware upload has already failed on
 * this machine for want of it while every screen here said the board was
 * fine. It has **five free eraseblocks out of 2040** on a NAND it reflashes
 * regularly. Neither number was visible from a browser.
 *
 * Five rows, each of which is a different question:
 *
 * - **uptime** -- how long ago this BMC booted, which is also the frame every
 *   other duration on this interface has to be read against.
 * - **load** -- what it is being asked to do.
 * - **memory** -- what is left to ask it with, drawn as the same bar user
 *   storage uses.
 * - **NAND** -- what is left to write firmware into, with no bar and no
 *   colour, because nothing here knows what a healthy margin is.
 * - **clock** -- whether the timestamps anything on this board produces mean
 *   anything, including the ones this interface renders.
 *
 * Every section degrades on its own. A daemon that omits one renders that row
 * as words; a section that reports `present: false` renders as *not detected*
 * in amber; a request that fails leaves one muted line and the rest of the
 * page untouched.
 */

/** The hottest sensor. The fan and its trips are on the Cooling page. */
function TemperatureReading() {
  const { t } = useTranslation();
  // Fifteen seconds, not the fan card's five. This tab is the one the
  // interface opens on, and a poll here is paid by every page left open on a
  // board with 116 MB of RAM.
  const { data, isError } = useThermalQuery(15000);

  if (isError) return <Absent />;
  if (!data)
    return <span className="text-muted-foreground">{EMPTY_VALUE}</span>;

  const hottest = hottestReading(data.sensors);
  if (hottest === null) return <Absent />;

  return (
    <span className="font-medium">
      {t("info.healthTemperature", { celsius: hottest.toFixed(1) })}
    </span>
  );
}

export default function BoardHealth() {
  const { t } = useTranslation();
  const { data: about } = useAboutTabData();
  const address = useAddressQuery();
  const { data, isPending, isError } = useHealthQuery();
  const durationLabel = useDurationLabel();

  const uptime =
    data?.uptime_seconds === null || data?.uptime_seconds === undefined
      ? null
      : durationLabel(data.uptime_seconds);
  const ip = address.data?.live.address;
  const serial = eepromLabel(about.board_serial);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("info.boardInfo")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl>
          <TableItem term={t("about.boardModel")}>
            <span className="font-medium">
              {eepromLabel(about.board_model)} (
              {versionLabel(about.board_revision)})
            </span>
          </TableItem>
          <TableItem term={t("about.boardSerial")}>
            <span className="inline-flex items-center gap-1 font-medium">
              {serial}
              {serial !== EMPTY_VALUE && <CopyButton value={serial} />}
            </span>
          </TableItem>
          <TableItem term={t("about.hostname")}>
            <span className="font-medium">{about.hostname || EMPTY_VALUE}</span>
          </TableItem>
          <TableItem term={t("info.boardIp")}>
            {ip ? (
              <span className="inline-flex items-center gap-1 font-medium">
                {ip}
                <CopyButton value={ip} />
              </span>
            ) : (
              <Absent />
            )}
          </TableItem>
          {data && (
            <>
              <TableItem term={t("info.healthUptime")}>
                {uptime === null ? (
                  <Absent />
                ) : (
                  <span className="font-medium">{uptime}</span>
                )}
              </TableItem>
              <TableItem term={t("info.healthLoad")}>
                {data.load === null ? (
                  <Absent />
                ) : (
                  <LoadReading load={data.load} />
                )}
              </TableItem>
              <TableItem term={t("info.healthMemory")}>
                {data.memory === null ? (
                  <Absent />
                ) : (
                  <MemoryReading memory={data.memory} />
                )}
              </TableItem>
              <TableItem term={t("info.healthTemperatureTerm")}>
                <TemperatureReading />
              </TableItem>
              <TableItem term={t("info.healthNand")}>
                {data.nand === null ? (
                  <Absent />
                ) : (
                  <NandReading nand={data.nand} />
                )}
              </TableItem>
              <StorageRows />
              <TableItem term={t("info.healthClock")}>
                {data.clock === null ? (
                  <Absent />
                ) : (
                  <ClockReading clock={data.clock} />
                )}
              </TableItem>
            </>
          )}
        </dl>

        {isPending && <HealthSkeleton />}

        {isError && (
          <p className="text-sm text-muted-foreground">
            {t("info.healthUnavailable")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
