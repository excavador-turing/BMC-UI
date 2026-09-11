import {
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";

import { useAxiosWithAuth } from "./_core";
import type { components } from "./schema";

/**
 * The daemon's own description of what it sends, generated from the OpenAPI
 * document that bmcd release publishes. Regenerate with `npm run api:refresh`
 * after moving the pin in `bmcd-release.txt`; CI fails if the committed file
 * and the pinned release disagree.
 *
 * Types only. The hooks below stay hand-written, because which endpoint uses
 * a suspense query and which must not is a decision with a reason behind it --
 * a suspense query that throws takes the whole route to its error component,
 * which is how one failed `about` used to blank the interface.
 */
type Schemas = components["schemas"];

interface APIResponse<T> {
  response: {
    result: T;
  }[];
}

interface USBTabResponse {
  bus_type: "Single bus" | "Usb hub";
  mode: "Host" | "Device" | "Flash";
  node: "Node 1" | "Node 2" | "Node 3" | "Node 4";
  route: "Bmc" | "AlternativePort";
}

interface PowerTabResponse {
  node1: "0" | "1";
  node2: "0" | "1";
  node3: "0" | "1";
  node4: "0" | "1";
}

type AboutTabResponse = Schemas["About"];

/**
 * What is waiting in the staging volume, as recorded by whatever put it there.
 *
 * Every field is optional because the note is written by something else --
 * `tpi-selfupdate`, or the daemon's upgrade worker -- and one written by an
 * older writer should degrade to "less is known", never to a wrong answer.
 * `version` is absent for an image whose filename does not follow the release
 * naming; `file` is what there is to show then.
 */
export type StagedImage = Schemas["StagedImage"];

/** One channel's answer from the board's own updater. */
export type UpdateChannel = Schemas["ChannelState"];

/**
 * Whether a newer firmware release exists.
 *
 * `error` is present when a channel could not be resolved -- usually a board
 * with no route out -- and may be present ALONGSIDE a channel when only one
 * of the two resolved. A missing channel is not the same as "no update".
 */
export type UpdateCheckResponse = Schemas["UpdateCheck"];

/** Where the board looks for firmware. */
export type FirmwareSource = Schemas["Source"];

export type FirmwareSources = Schemas["Sources"];

/**
 * How much is known about an image's integrity. Three genuinely different
 * things, which must not render alike: a checksum published by the release
 * and verified on download; TLS only, because the publisher ships none;
 * and a local file whose provenance is whatever put it there.
 */
export type FirmwareTrust = "verified" | "tls" | "unverified";

/**
 * How a candidate relates to what is running. `unknown` is not a failure --
 * a board running a locally built image has no version to order against, and
 * saying so beats inventing an order.
 */
export type FirmwareRelation = "current" | "newer" | "older" | "unknown";

export type FirmwareCandidate = Schemas["Candidate"];

export type FirmwareSourceCatalog = Schemas["SourceCatalog"];

export type FirmwareCatalog = Schemas["Catalog"];

export interface FlashStatus {
  Transferring?: {
    id: number;
    process_name: string;
    size: number;
    cancelled: boolean;
    bytes_written: number;
  };
  Done?: [{ secs: number; nanos: number }, number];
  Error?: string;
}

/**
 * One half of the board's A/B firmware layout, as `type=firmware_slots`
 * reports it.
 *
 * `version` is null whenever the version cannot be read rather than whenever
 * it is empty, and on the rollback slot that is the normal case: the volume
 * is not mounted, so nothing on the board can open the file that carries it.
 * The volume name and its size are what is left, and they are what gets
 * rendered -- a guessed version on the slot a rollback would land on is the
 * one number in this panel that must never be invented.
 */
export type FirmwareSlot = Schemas["Slot"];

/**
 * The verdict the board's boot-time health gate reached the last time it
 * promoted a slot: when it ran, and what it decided.
 *
 * `timestamp` arrives as the board's own `date(1)` output rather than as
 * ISO 8601, so it is rendered verbatim. Handing that string to `new Date()`
 * would print "Invalid Date" on any engine that parses it differently, and
 * the board's own words are more use here than a reformatting of them.
 */
export type FirmwarePromotion = Schemas["Promotion"];

/** What the daemon sends. Every key is allowed to be missing. */
interface FirmwareSlotsWire {
  running?: FirmwareSlot | null;
  rollback?: FirmwareSlot | null;
  update_staged?: boolean | null;
  nextboot?: string | null;
  present?: boolean | null;
  last_promotion?: FirmwarePromotion | null;
  staged?: StagedImage | null;
}

/**
 * The A/B firmware state, normalised so every field is answerable.
 *
 * `update_staged` is a three-valued field on purpose. True means the next
 * reboot switches slots; false means it does not; **null means the boot
 * environment could not be read**, which is not the same claim and must not
 * be drawn as "no". A panel that renders a failed read as a reassuring "no"
 * is how a board reboots into firmware nobody expected.
 */
export interface FirmwareSlotsResponse {
  running: FirmwareSlot | null;
  rollback: FirmwareSlot | null;
  update_staged: boolean | null;
  nextboot: string | null;
  present: boolean;
  last_promotion: FirmwarePromotion | null;
  /**
   * Which image is staged, when whatever staged it left a note. `null` with
   * `update_staged` true means an image is pending that was armed by
   * something which writes no note -- not that nothing is pending.
   */
  staged: StagedImage | null;
}

type InfoTabResponse = Schemas["BoardInfo"];

/**
 * One port of the on-board switch, as `type=network` reports it.
 *
 * `node1`..`node4` carry a compute module each; `ge0`/`ge1` are the uplinks.
 * `present` is the switch driver's own answer to "did I probe this port": it
 * is false when the driver never came up, which is a different and much worse
 * condition than a port that probed and has no link.
 */
export type SwitchPort = Schemas["SwitchPort"];

interface NetworkTabResponse {
  ports: SwitchPort[];
}

type CoolingDevice = Schemas["CoolingDevice"];

/**
 * One thermal sensor, as `type=thermal` reports it.
 *
 * Until this week no Turing Pi 2 could measure its own temperature at all:
 * the SoC thermal sensor was missing from every device tree, so the fan ran
 * flat out with nothing to regulate against. `bmc-thermal` is that sensor,
 * now that it exists.
 *
 * `present` is the daemon's answer to "did the read succeed". It is false
 * when the zone is declared but unreadable, and `temperature_c` means
 * nothing in that case -- which is why it is checked before the number is
 * ever formatted. A board that cannot measure must not be shown as 0 degrees.
 */
/** A trip point: a temperature, and what crossing it means. */
export type ThermalTrip = Schemas["Trip"];

export type ThermalSensor = Schemas["ThermalSensor"];

/**
 * One cooling device as the kernel's thermal layer sees it.
 *
 * The same fan `type=cooling` exposes, reported the other way round: as the
 * discrete step the thermal governor has it at, out of the steps the device
 * tree declares. `type=cooling` reports the setpoint somebody wrote;
 * `cur_state` here is where the fan actually is, which on firmware carrying
 * a thermal cooling-map is whatever the governor last decided rather than
 * whatever was last written.
 *
 * `levels` is the board's own `cooling-levels` table, read out of the device
 * tree by the daemon and reported rather than assumed. It is what turns a
 * step into a duty cycle: `levels[cur_state] / max_level`. This interface
 * refused to print a percentage for as long as that table was not reported by
 * any endpoint, because the only way to have one was to hardcode a single
 * board's device tree and call it a measurement. Now it is measured.
 *
 * Null when the table could not be read. That is a real state on boards whose
 * device tree does not declare one, and the step alone is what gets shown --
 * never a duty computed from a guessed table.
 */
export type ThermalCooling = Schemas["Cooler"];

/**
 * Both lists are allowed to be empty, and empty is not an error: it is the
 * correct answer from any board or firmware that predates the thermal
 * sensor. It means "cannot measure", which the interface has to render as
 * unavailable rather than as a reading of zero.
 */
export type ThermalResponse = Schemas["Thermal"];

/**
 * The kernel load average, as `type=health` reports it.
 *
 * `present` is the daemon's answer to "could I read /proc/loadavg", not a
 * claim about the numbers. A board that could not read it must not render as
 * an idle one.
 */
export type HealthLoad = Schemas["Load"];

/**
 * The BMC's own RAM.
 *
 * This board has 116 MB of it in total, and that is not a decoration: a
 * firmware upload has already failed on this machine for want of memory,
 * while every page of this interface said the board was fine. `available` is
 * the kernel's own estimate of what a new allocation could actually get, so
 * `total - available` is what is in use and not reclaimable, and that is the
 * number the bar draws. `free` is the smaller, less useful figure and is
 * shown beside it rather than instead of it.
 */
export type HealthMemory = Schemas["Memory"];

/**
 * The NAND the firmware lives on, in the eraseblocks UBI counts it in.
 *
 * On a board that is reflashed often this is the number that runs out. Bad
 * eraseblocks are the ones that never come back; reserved ones are the pool
 * held aside to replace them.
 */
export type HealthNand = Schemas["Nand"];

/** One real-time clock device the board carries. */
export type HealthRtc = Schemas["Rtc"];

/**
 * The board's clock, and what is keeping it.
 *
 * `synchronised` is three-valued. True and false are chrony's answer; **null
 * means chrony could not be reached**, which is a different fact and must not
 * be drawn as "not synchronised" -- one says the clock is wrong, the other
 * says nobody knows.
 *
 * `offset_seconds` arrives from serde in exponent form for small values; see
 * `offsetReading` in `src/lib/format.ts`.
 */
export type HealthClock = Schemas["Clock"];

/** What the daemon sends. Every key, and every sub-key, may be missing. */
interface HealthWire {
  uptime_seconds?: number | null;
  load?: HealthLoad | null;
  memory?: HealthMemory | null;
  nand?: HealthNand | null;
  clock?: (Partial<HealthClock> & { rtc?: HealthRtc[] | null }) | null;
}

/**
 * Board health, normalised so every section is answerable.
 *
 * A null section means the daemon did not report it at all, which is not the
 * same as a section that reported `present: false` -- the first is an older
 * daemon, the second is a board that tried and could not read. Both render as
 * words rather than as zeroes.
 */
export interface HealthResponse {
  uptime_seconds: number | null;
  load: HealthLoad | null;
  memory: HealthMemory | null;
  nand: HealthNand | null;
  clock: HealthClock | null;
}

export interface NodeInfoResponse {
  module_name: string | null;
  name: string | null;
  power_on_time: number | null;
  uart_baud: string | null;
}

export function useUSBTabData() {
  const api = useAxiosWithAuth();

  return useSuspenseQuery({
    queryKey: ["usbTabData"],
    queryFn: async () => {
      const response = await api.get<APIResponse<USBTabResponse[]>>("/bmc", {
        params: {
          opt: "get",
          type: "usb",
        },
      });
      return response.data.response[0].result[0];
    },
  });
}

export function usePowerTabData() {
  const api = useAxiosWithAuth();

  return useSuspenseQuery({
    queryKey: ["powerTabData"],
    queryFn: async () => {
      const response = await api.get<APIResponse<PowerTabResponse>>("/bmc", {
        params: {
          opt: "get",
          type: "power",
        },
      });
      return response.data.response[0].result;
    },
  });
}

/**
 * The upgrade candidate. Its own query, so a slow or failing check never
 * holds up the firmware page: the slot panel renders from `firmware_slots`
 * regardless of what this does.
 */
export function useFirmwareSourcesQuery() {
  const api = useAxiosWithAuth();

  return useQuery({
    queryKey: ["firmwareSources"],
    queryFn: async () => {
      const response = await api.get<APIResponse<FirmwareSources>>("/bmc", {
        params: { opt: "get", type: "firmware_sources" },
      });
      return response.data.response[0].result;
    },
    retry: false,
  });
}

/**
 * What every enabled source offers.
 *
 * Not polled: each refresh spends GitHub's unauthenticated budget, and the
 * daemon caches for half an hour anyway. `refresh` is what the "check now"
 * control passes, because a page that can only report what it thought half an
 * hour ago cannot confirm a release published since.
 */
export function useFirmwareAvailableQuery() {
  const api = useAxiosWithAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["firmwareAvailable"],
    queryFn: async () => {
      const response = await api.get<APIResponse<FirmwareCatalog>>("/bmc", {
        params: { opt: "get", type: "firmware_available" },
      });
      return response.data.response[0].result;
    },
    refetchInterval: false,
    retry: false,
  });

  /**
   * What "check now" calls.
   *
   * `refetch()` alone replays the query above, which sends no `refresh` and so
   * gets the daemon's cached answer back -- the one control whose purpose is
   * to bypass that cache was the one control that did not.
   *
   * The daemon returns at once and refreshes behind itself (bmcd 2.11.0), so
   * this resolves quickly and the answer arrives in a later poll. While
   * `catalog.refreshing` is set the page polls every two seconds to pick it
   * up, and stops when it clears.
   */
  const checkNow = async () => {
    const response = await api.get<APIResponse<FirmwareCatalog>>("/bmc", {
      params: { opt: "get", type: "firmware_available", refresh: 1 },
    });
    queryClient.setQueryData(
      ["firmwareAvailable"],
      response.data.response[0].result
    );
  };

  return { ...query, checkNow };
}

export function useUpdateCheckQuery() {
  const api = useAxiosWithAuth();

  return useQuery({
    queryKey: ["updateCheck"],
    queryFn: async () => {
      const response = await api.get<APIResponse<UpdateCheckResponse>>("/bmc", {
        params: { opt: "get", type: "update_check" },
      });
      return response.data.response[0].result;
    },
    // The daemon caches this for an hour; asking more often only spends the
    // board's cores. Never retried: a board with no route out answers the
    // same way in ten seconds, and it reports the reason in `error`.
    staleTime: 1000 * 60 * 30,
    refetchInterval: false,
    retry: false,
  });
}

export function useAboutTabData() {
  const api = useAxiosWithAuth();

  return useSuspenseQuery({
    queryKey: ["aboutTabData"],
    staleTime: 1000 * 60 * 60, // Valid for 1 hour
    queryFn: async () => {
      const response = await api.get<APIResponse<AboutTabResponse>>("/bmc", {
        params: {
          opt: "get",
          type: "about",
        },
      });
      return {
        ...response.data.response[0].result,
        buildtime: new Date(response.data.response[0].result.buildtime),
      };
    },
  });
}

export function useInfoTabData() {
  const api = useAxiosWithAuth();

  return useSuspenseQuery({
    queryKey: ["infoTabData"],
    queryFn: async () => {
      const response = await api.get<APIResponse<InfoTabResponse>>("/bmc", {
        params: {
          opt: "get",
          type: "info",
        },
      });
      return response.data.response[0].result;
    },
  });
}

export function useNodesTabData() {
  const api = useAxiosWithAuth();

  return useSuspenseQuery({
    queryKey: ["nodesTabData"],
    queryFn: async () => {
      const response = await api.get<APIResponse<NodeInfoResponse[]>>("/bmc", {
        params: {
          opt: "get",
          type: "node_info",
        },
      });
      return response.data.response[0].result;
    },
  });
}

export function useFlashStatusQuery(enabled: boolean) {
  const api = useAxiosWithAuth();

  return useQuery({
    queryKey: ["flashStatus"],
    staleTime: 1000, // Valid for 1 second
    queryFn: async () => {
      const response = await api.get<FlashStatus>("/bmc", {
        params: {
          opt: "get",
          type: "flash",
        },
      });
      return response.data;
    },
    refetchInterval: 1000, // Refetch every 1 second
    enabled, // Enable/disable the query based on the provided boolean value
  });
}

export function useFirmwareStatusQuery(enabled: boolean) {
  const api = useAxiosWithAuth();

  return useQuery({
    queryKey: ["firmwareStatus"],
    staleTime: 1000, // Valid for 1 second
    queryFn: async () => {
      const response = await api.get<FlashStatus>("/bmc", {
        params: {
          opt: "get",
          type: "firmware",
        },
      });
      return response.data;
    },
    refetchInterval: 1000, // Refetch every 1 second
    enabled, // Enable/disable the query based on the provided boolean value
  });
}

/**
 * Which firmware slot is running, and what a rollback would land on.
 *
 * `type=firmware_slots` is new in our bmcd fork, so this is a plain
 * `useQuery` for the reason the switch and thermal panels are: a suspense
 * query that throws takes the whole route to its error component, and on this
 * route that would mean losing the upload form -- the one control the page
 * exists for -- because a status panel could not be filled in.
 *
 * Polled at ten seconds rather than the five the Info page uses. Slot state
 * moves at the pace of a flash or a reboot, not of a fan, and the one
 * transition worth catching from this page is `update_staged` turning true
 * once an upload finishes writing. Ten seconds catches that well inside the
 * time it takes to read the panel, on a board with 116 MB of RAM that is
 * being asked to write firmware at the same moment.
 *
 * Missing keys are normalised rather than trusted. `present` in particular
 * falls back to the evidence -- a running slot is what an A/B layout looks
 * like -- because the panel must neither invent slots nor hide ones the
 * daemon actually sent.
 */
export function useFirmwareSlotsQuery() {
  const api = useAxiosWithAuth();

  return useQuery({
    queryKey: ["firmwareSlots"],
    queryFn: async () => {
      const response = await api.get<APIResponse<FirmwareSlotsWire>>("/bmc", {
        params: {
          opt: "get",
          type: "firmware_slots",
        },
      });
      const result = response.data.response[0].result;
      return {
        running: result.running ?? null,
        rollback: result.rollback ?? null,
        update_staged: result.update_staged ?? null,
        nextboot: result.nextboot ?? null,
        present: result.present ?? Boolean(result.running),
        last_promotion: result.last_promotion ?? null,
        staged: result.staged ?? null,
      } satisfies FirmwareSlotsResponse;
    },
    // Stop polling once it has failed: an older daemon answers the same way
    // in ten seconds' time, and a panel reporting its own absence has no
    // reason to keep asking.
    refetchInterval: (query) => (query.state.error ? false : 10000),
    retry: false,
  });
}

export function useCoolingDevicesQuery() {
  const api = useAxiosWithAuth();

  return useSuspenseQuery({
    queryKey: ["coolingDevices"],
    queryFn: async () => {
      const response = await api.get<APIResponse<CoolingDevice[]>>("/bmc", {
        params: {
          opt: "get",
          type: "cooling",
        },
      });
      return response.data.response[0].result;
    },
  });
}

/**
 * Board temperature and the cooling devices the kernel drives from it.
 *
 * `useQuery`, not `useSuspenseQuery`, for the same reason the switch panel
 * is one: `type=thermal` exists only in our bmcd fork, and a suspense query
 * that throws takes the whole Info route to its `errorComponent` -- storage,
 * board health and the reboot buttons vanishing because a temperature was
 * unavailable. The card degrades to one line of prose instead.
 *
 * Polled at five seconds, because a temperature read once when the tab was
 * opened is not a temperature. It is also what makes the fan's step honest:
 * the kernel governor re-asserts the fan from the temperature on its own
 * schedule, so a manual setting is undone within seconds, and a card that
 * only read the fan at mount would show the setting rather than the fan.
 *
 * Missing lists are normalised to empty ones. A daemon that answers this
 * endpoint at all is ours, but "answers it" and "sends both keys" are
 * different promises, and `undefined.length` is not a useful failure.
 */
/**
 * `intervalMs` because two cards read this and they do not deserve the same
 * cadence. The fan card is a control surface and wants five seconds; Board
 * Health shows the same sensor as one reading among six, on the tab this
 * interface opens on, and a five-second poll there is a cost the board pays
 * for every page left open.
 */
export function useThermalQuery(intervalMs = 5000) {
  const api = useAxiosWithAuth();

  return useQuery({
    queryKey: ["thermal", intervalMs],
    queryFn: async () => {
      const response = await api.get<APIResponse<ThermalResponse>>("/bmc", {
        params: {
          opt: "get",
          type: "thermal",
        },
      });
      const result = response.data.response[0].result;
      return {
        sensors: result.sensors ?? [],
        // The levels table is normalised the same way the lists are: a daemon
        // that answers this endpoint at all is ours, but "answers it" and
        // "reports a cooling-levels table" are different promises, and an
        // undefined that reaches the duty arithmetic is how a percentage gets
        // invented.
        cooling: (result.cooling ?? []).map((fan) => ({
          ...fan,
          levels: fan.levels ?? null,
          max_level: fan.max_level ?? null,
        })),
      };
    },
    // Stop polling once it has failed: an older daemon answers the same way
    // in five seconds' time, and a card reporting its own absence has no
    // reason to keep asking.
    refetchInterval: (query) => (query.state.error ? false : intervalMs),
    retry: false,
  });
}

/**
 * How the BMC itself is doing: uptime, load, memory, NAND and the clock.
 *
 * `type=health` is new in our bmcd fork, so this is a plain `useQuery` for
 * the reason the switch and thermal panels are: a suspense query that throws
 * takes the whole Info route to its error component, and losing storage, the
 * fan and the reboot buttons because a load average was unavailable is a bad
 * trade. Five seconds, the same cadence as the two panels beside it, so the
 * page has one tick rather than three.
 *
 * Each section is normalised to null when absent, and the clock is rebuilt
 * field by field because it is the one section whose sub-keys carry meaning
 * when missing: `synchronised` has to stay three-valued through this, and
 * `rtc` has to become an empty list rather than an undefined one.
 */
export function useHealthQuery() {
  const api = useAxiosWithAuth();

  return useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const response = await api.get<APIResponse<HealthWire>>("/bmc", {
        params: {
          opt: "get",
          type: "health",
        },
      });
      const result = response.data.response[0].result;
      const clock = result.clock;
      return {
        uptime_seconds: result.uptime_seconds ?? null,
        load: result.load ?? null,
        memory: result.memory ?? null,
        nand: result.nand ?? null,
        clock: clock
          ? {
              synchronised: clock.synchronised ?? null,
              source: clock.source ?? null,
              stratum: clock.stratum ?? null,
              offset_seconds: clock.offset_seconds ?? null,
              measured_by: clock.measured_by ?? null,
              rtc: clock.rtc ?? [],
            }
          : null,
      } satisfies HealthResponse;
    },
    // Stop polling once it has failed, as the panels beside it do: an older
    // daemon answers the same way in five seconds' time.
    refetchInterval: (query) => (query.state.error ? false : 5000),
    retry: false,
  });
}

/**
 * Switch port state.
 *
 * `useQuery`, not `useSuspenseQuery` like the rest of this file, on purpose.
 * `type=network` is new in our bmcd fork, so an older daemon answers it with
 * an error -- and a suspense query that throws takes the whole Network route
 * to its `errorComponent`, losing the BMC's own addresses and the Reset
 * Network button along with the panel. A panel that reports its own absence
 * is worth more than one that takes the page down with it.
 *
 * Polled, unlike the other queries in this file, because link state is the
 * point: a panel showing an uplink that came back three minutes ago as still
 * down is worse than no panel. Five seconds is slow enough to be free on a
 * BMC and fast enough that a cable pull is visible before you reach for the
 * page.
 *
 * The Nodes page reads this same cached query for its per-node link state,
 * which is why the key stays `switchPorts` rather than being named after
 * either page.
 */
/**
 * What is on the SD card, and which of it could be written to a module.
 *
 * The daemon decides both: `flashable` and `reason` come from it, not from a
 * filename check here. An interface that guessed would disagree with the
 * daemon the moment either changed, and the disagreement would show up as a
 * flash that refuses after the operator already pressed the button.
 */
export type SdCardEntry = Schemas["SdCardEntry"];

/** Capacity and use, from `statvfs` on the mount point. */
export type SdCardUsage = Schemas["SdCard"];

export function useSdCardQuery(enabled = true) {
  const api = useAxiosWithAuth();

  return useQuery({
    queryKey: ["sdCard"],
    enabled,
    queryFn: async () => {
      // An ARRAY of one, not an object: the document says `minItems: 1,
      // maxItems: 1` and the board agrees. Reading it as an object gives an
      // undefined `free`, which reaches `filesize` and throws "Invalid
      // number" -- a blank tab with the cause three layers away.
      const response = await api.get<APIResponse<SdCardUsage[]>>("/bmc", {
        params: { opt: "get", type: "sdcard" },
      });
      return response.data.response[0].result[0];
    },
    // No polling. A card's capacity does not move while you look at it, and
    // this board has 116 MB of RAM -- every interval here is a cost it pays
    // for as long as the tab is open.
    retry: false,
  });
}

/**
 * The listing, fetched only while the picker is open.
 *
 * `enabled` rather than an always-on query: reading a directory tree off an
 * SD card is the most expensive thing on this tab, and nobody is looking at
 * it until they open the picker.
 */
export function useSdCardFilesQuery(enabled: boolean) {
  const api = useAxiosWithAuth();

  return useQuery({
    queryKey: ["sdCardFiles"],
    enabled,
    queryFn: async () => {
      const response = await api.get<APIResponse<SdCardEntry[]>>("/bmc", {
        params: { opt: "get", type: "sdcard_files" },
      });
      return response.data.response[0].result;
    },
    // A daemon older than 2.34.0 has no such endpoint and will answer the
    // same way in five seconds. The picker says so rather than spinning.
    retry: false,
    staleTime: 10_000,
  });
}

export function useSwitchPortsQuery() {
  const api = useAxiosWithAuth();

  return useQuery({
    queryKey: ["switchPorts"],
    queryFn: async () => {
      const response = await api.get<APIResponse<NetworkTabResponse>>("/bmc", {
        params: {
          opt: "get",
          type: "network",
        },
      });
      return response.data.response[0].result.ports;
    },
    // Stop polling once it has failed: an older daemon will fail the same
    // way in five seconds' time, and a panel reporting its own absence has no
    // reason to keep asking a BMC that has already answered.
    refetchInterval: (query) => (query.state.error ? false : 5000),
    retry: false,
  });
}

export function useUSBNode1Query() {
  const api = useAxiosWithAuth();

  return useSuspenseQuery({
    queryKey: ["usbNode1"],
    queryFn: async () => {
      const response = await api.get<APIResponse<boolean>>("/bmc", {
        params: {
          opt: "get",
          type: "usb_node1",
        },
      });

      return response.data.response[0].result;
    },
  });
}

/**
 * The state of bmcd's UART reader task, per node.
 *
 * `Initialized` is a task that exists and has not started reading;
 * `Running` is one that is reading; `Stopped` is one that has ended. Typed
 * as a plain string rather than a union of those three, on purpose: nothing
 * checks the wire at runtime, and a daemon that grows a fourth state should
 * put that state on the screen rather than have it narrowed away into a
 * value the renderer believes is one of three.
 */
export type SerialReaderState = string;

/**
 * Whether the daemon is reading each node's UART.
 *
 * `POST`, not `GET`, and not because anything is being changed -- that is
 * simply the method bmcd exposes `/api/bmc/serial/status` under. It sits in
 * this file rather than `set.ts` because it reads.
 *
 * This says nothing about the modules. It reports the liveness of four
 * reader tasks inside bmcd: a node that is powered off, or booted and
 * silent, has a reader in exactly the same state as one mid-boot. It is
 * worth showing because a `Stopped` reader explains an empty terminal that
 * no amount of looking at the module would, and it must not be labelled as
 * module health.
 *
 * `useQuery`, like the other endpoints new in our bmcd fork, so a daemon
 * that does not have it degrades to one line of prose instead of taking the
 * route to its `errorComponent`. A non-array body is normalised away for the
 * same reason: an older daemon answering this path with something else must
 * not put `undefined` in a status cell.
 */
export function useSerialStatusQuery() {
  const api = useAxiosWithAuth();

  return useQuery({
    queryKey: ["serialStatus"],
    queryFn: async () => {
      const response =
        await api.post<SerialReaderState[]>("/bmc/serial/status");
      return Array.isArray(response.data) ? response.data : [];
    },
    // Stop polling once it has failed: an older daemon answers the same way
    // in five seconds' time.
    refetchInterval: (query) => (query.state.error ? false : 5000),
    retry: false,
  });
}

/**
 * What the board calls itself: the live name, and the one that takes effect at
 * the next boot.
 *
 * Both, because they differ when someone has run `hostname` by hand, and a
 * page that shows only one cannot explain why the board answers to a name the
 * settings do not show.
 */
export interface HostnameResponse {
  hostname: string | null;
  on_next_boot: string | null;
}

export function useHostnameQuery() {
  const api = useAxiosWithAuth();

  return useQuery({
    queryKey: ["hostname"],
    queryFn: async () => {
      const response = await api.get<APIResponse<HostnameResponse>>("/bmc", {
        params: { opt: "get", type: "hostname" },
      });
      return response.data.response[0].result;
    },
    // Plain useQuery with retry off, like everything else this fork added: an
    // older bmcd that has no such endpoint must degrade to a missing card
    // rather than blanking the route.
    retry: false,
  });
}

/** The clock's state, as chrony reports it. */
export interface NtpClock {
  synchronised: boolean | null;
  source: string | null;
  stratum: number | null;
  offset_seconds: number | null;
}

export interface NtpResponse {
  servers: string[];
  /**
   * False on an image whose `chrony.conf` predates the `sourcedir` line. A
   * list saved on such a board is written and silently never read, so the card
   * says so rather than offering a setting that does nothing.
   */
  configurable: boolean;
  clock: NtpClock;
}

export function useNtpQuery() {
  const api = useAxiosWithAuth();

  return useQuery({
    queryKey: ["ntp"],
    queryFn: async () => {
      const response = await api.get<APIResponse<NtpResponse>>("/bmc", {
        params: { opt: "get", type: "ntp" },
      });
      return response.data.response[0].result;
    },
    // The clock line underneath is live state, and a person who has just
    // pointed the board at a server wants to see it take within a poll.
    refetchInterval: (query) => (query.state.error ? false : 5000),
    retry: false,
  });
}
