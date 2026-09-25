import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import InfoNote from "@/components/InfoNote";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  type ThermalSensor,
  useCoolingDevicesQuery,
  useThermalQuery,
} from "@/lib/api/get";
import { useCoolingDeviceMutation } from "@/lib/api/set";
import { fanDutyPercent, isReading } from "@/lib/format";
import { governorReason } from "@/lib/thermal";
import { cn } from "@/lib/utils";

/**
 * One fan, merged from the two endpoints that describe it.
 *
 * `type=cooling` says what can be commanded; `type=thermal` says where the
 * fan actually is. They are not the same number and the difference is the
 * point of this card, so they are kept apart rather than averaged into one.
 */
interface FanRow {
  name: string;
  /** Highest step. From the controllable side when there is one. */
  max: number;
  /** The step the board reports now, or null when nothing reported one. */
  live: number | null;
  /** The setpoint `type=cooling` returned at mount; the slider's origin. */
  setpoint: number | null;
  /** False for a fan only `type=thermal` knows: there is nothing to set. */
  controllable: boolean;
  /** False only when `type=thermal` says the device is not there. */
  present: boolean;
  /** The board's own cooling-levels table, or null when it reports none. */
  levels: number[] | null;
  /** The level that means full duty. Null when the table is unreadable. */
  maxLevel: number | null;
  /**
   * Whether a step written to this fan would actually hold.
   *
   * True only when the daemon reports both a governor it can pause and the
   * state of that governor. A daemon that reports neither is one whose
   * slider the kernel overrules within a poll, and offering an Override
   * switch there would be offering a control that does not do what it says.
   */
  canHold: boolean;
  /** Whether the governor is paused for this fan right now. */
  overridden: boolean;
}

/**
 * The fan's step, drawn as the discrete thing it is.
 *
 * The card used to render `Math.round(speed / max_speed * 100)` and print it
 * with a percent sign. That number was wrong in two separate ways. It is the
 * *index* as a fraction of the highest index, so step 4 of 6 showed as 67 %;
 * and the steps are not evenly spaced anyway -- the device tree declares
 * `cooling-levels = <0 16 32 64 102 170 254>`, so step 4 is a PWM duty of
 * 102/254, about 40 %. The screen agreed with neither the index nor the duty,
 * and a continuous-looking readout invited the reader to believe a fan with
 * seven positions could sit anywhere between them.
 *
 * One filled segment per step, and the step in words beside it. That stays the
 * primary reading, because it is the honest one: the fan has seven positions
 * and this is which of them it is in.
 *
 * The duty cycle now sits under it, quieter, and it is a measurement rather
 * than an assumption. `type=thermal` reports the board's own `cooling-levels`
 * table, so the percentage is computed from the numbers the board sent -- the
 * objection that kept it off this card was that no endpoint reported the
 * table, and that objection has been answered. When a board reports no table
 * the step stands alone; a duty is never computed from a guessed one.
 */
function StepBar({
  value,
  max,
  label,
  valueText,
}: {
  value: number;
  max: number;
  label: string;
  valueText?: string;
}) {
  return (
    <div
      className="flex w-full items-center gap-1"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
    >
      {Array.from({ length: max }, (_, index) => index + 1).map((step) => (
        <div
          key={step}
          className={cn(
            "h-2 flex-1 rounded-xs",
            step <= value ? "bg-primary" : "bg-muted"
          )}
        />
      ))}
    </div>
  );
}

/**
 * One sensor's reading.
 *
 * `present` is checked before the number is touched, and so is
 * `Number.isFinite`: a daemon that sends null, a string or nothing at all for
 * a sensor it could not read must not produce `0.0 °C` or `NaN °C` on a page
 * whose whole purpose is to say whether the board is hot. Unreadable is a
 * state with its own words.
 */
/** A one-thumb slider's value: Base UI types it as either shape. */
const single = (value: number | readonly number[]) =>
  typeof value === "number" ? value : (value[0] ?? 0);

function SensorReading({ sensor }: { sensor: ThermalSensor }) {
  const { t } = useTranslation();

  if (!sensor.present || !isReading(sensor.temperature_c)) {
    return (
      <span className="font-medium text-warning">
        {t("info.thermalAbsent")}
      </span>
    );
  }

  return (
    <span className="font-medium">
      {t("info.thermalCelsius", { value: sensor.temperature_c.toFixed(1) })}
    </span>
  );
}

/**
 * The temperatures at which the board steps its fan up, from the sensor's own
 * `active` trips, with the ones already crossed filled in. It is what makes
 * "4 of 6" read as a consequence rather than a number. `hot` and `critical`
 * trips are the board's alarm lines, not fan steps, and are shown in red.
 */
function TripScale({ sensor }: { sensor: ThermalSensor }) {
  const { t } = useTranslation();

  const trips = (sensor.trips ?? [])
    .filter((trip) => isReading(trip.temperature_c))
    .sort((a, b) => (a.temperature_c ?? 0) - (b.temperature_c ?? 0));
  const active = trips.filter((trip) => trip.kind === "active");
  const alarms = trips.filter(
    (trip) => trip.kind === "hot" || trip.kind === "critical"
  );
  if (active.length === 0 && alarms.length === 0) return null;

  const reading =
    sensor.present && isReading(sensor.temperature_c)
      ? sensor.temperature_c
      : null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      {active.length > 0 && (
        <span className="mr-1 text-muted-foreground">{t("info.fanTrips")}</span>
      )}
      {active.map((trip) => (
        <Badge
          key={trip.index}
          variant={
            reading !== null && reading >= (trip.temperature_c ?? 0)
              ? "default"
              : "outline"
          }
          className="tabular-nums"
        >
          {t("info.thermalCelsius", { value: trip.temperature_c })}
        </Badge>
      ))}
      {alarms.map((trip) => (
        <Badge key={trip.index} variant="destructive" className="tabular-nums">
          {trip.kind === "critical"
            ? t("info.tripCritical", { celsius: trip.temperature_c })
            : t("info.tripHot", { celsius: trip.temperature_c })}
        </Badge>
      ))}
    </div>
  );
}

function ThermalSkeleton() {
  return (
    <div className="flex flex-row py-1">
      <div className="w-1/2 lg:w-1/4">
        <Skeleton className="h-6 w-28" />
      </div>
      <Skeleton className="h-6 w-20" />
    </div>
  );
}

/**
 * Fan Control, with the temperature that drives it.
 *
 * Until this week the board could not measure its own temperature -- the SoC
 * thermal sensor was missing from every device tree -- so the fan ran flat
 * out and this card showed a percentage with nothing behind it. The sensor
 * and a fan curve exist now, the kernel regulates the fan, and the SoC reads
 * around 52 °C. This is where a reader looks for that number, because the fan
 * is the thing it drives.
 *
 * Three things are shown together and none of them is redundant:
 *
 * - **the temperature**, per sensor, or a line saying it cannot be measured;
 * - **the fan's step**, as segments and as "4 of 6", read from the polled
 *   `type=thermal` response -- what the fan is doing -- with the PWM duty
 *   that step commands underneath it, computed from the board's own
 *   cooling-levels table now that the daemon reports one;
 * - **the slider**, unchanged as a control and still uncontrolled, so its
 *   thumb stays where it was put -- what was asked for.
 *
 * When those last two disagree the reader is watching the governor take the
 * fan back, which is the truth about this machine and used to be invisible.
 */
/**
 * The hottest `active` trip any sensor declares, or null.
 *
 * This is the temperature at which the daemon takes a held fan back on its
 * own, so it is read from the same trips the daemon reads rather than
 * written down here as a number. Above it the governor would be asking for
 * the top step anyway, and a hold is no longer a preference worth keeping.
 */
function overrideCeiling(sensors: ThermalSensor[]): number | null {
  let hottest: number | null = null;
  for (const sensor of sensors) {
    for (const trip of sensor.trips ?? []) {
      if (trip.kind !== "active" || !isReading(trip.temperature_c)) continue;
      if (hottest === null || trip.temperature_c > hottest) {
        hottest = trip.temperature_c;
      }
    }
  }
  return hottest;
}

export default function FanControl() {
  const { t } = useTranslation();
  const { data: coolingDevices, refetch: refetchCooling } =
    useCoolingDevicesQuery();
  const {
    data: thermal,
    isPending,
    isError,
    dataUpdatedAt,
  } = useThermalQuery();
  const { toast } = useToast();
  const { mutate: mutateCoolingDevices } = useCoolingDeviceMutation();

  // The legacy endpoint answers a refusal with a 200 and the reason in
  // `result`, so a request that "succeeded" can still have changed nothing.
  // Whether it did is read back from the board rather than guessed from the
  // wording: an Override that did not take is reported, with the board's
  // own sentence. Without this it just looked like a switch that would not
  // stay on.
  const setFan = (
    variables: Parameters<typeof mutateCoolingDevices>[0],
    expectHeld?: boolean
  ) =>
    mutateCoolingDevices(variables, {
      onSuccess: (result) => {
        if (expectHeld === undefined) return;
        void refetchCooling().then(({ data: fresh }) => {
          const device = fresh?.find((d) => d.device === variables.device);
          if (
            device?.overridden !== undefined &&
            device.overridden !== expectHeld
          ) {
            toast({
              title: t("info.fanNotApplied"),
              description: typeof result === "string" ? result : undefined,
              variant: "destructive",
            });
          }
        });
      },
      onError: (error: Error) =>
        toast({
          title: t("info.fanNotApplied"),
          description: error.message,
          variant: "destructive",
        }),
    });

  const [requested, setRequested] = useState(() =>
    coolingDevices.reduce(
      (acc, device) => {
        acc[device.device] = device.speed;
        return acc;
      },
      {} as Record<string, number>
    )
  );

  // The last setting committed from this page, per device, with the moment it
  // was sent. Compared against a *later* poll it is the only evidence the
  // interface can offer that the governor undid it, as opposed to a guess
  // about what the firmware might be doing.
  const [committed, setCommitted] = useState<
    Record<string, { step: number; at: number }>
  >({});

  // The two endpoints name the same fan differently: `type=cooling` renames it
  // to the platform node behind it ("system fan"), while `type=thermal` passes
  // the kernel's own `type` through ("pwm-fan"). Matching on the name therefore
  // never matched, and the board rendered the one physical fan twice -- once
  // with a slider and once with a duty, each claiming step 4 of 6.
  //
  // When both endpoints report exactly one cooling device it is the same
  // device, and this board is that case. With any other shape, fall back to
  // matching by name: two fans that cannot be paired confidently are better
  // shown as two rows than merged on a guess.
  const thermalFans = thermal?.cooling ?? [];
  const pairByPosition =
    coolingDevices.length === 1 && thermalFans.length === 1;
  const live = new Map(thermalFans.map((fan) => [fan.name, fan]));

  const rows: FanRow[] = coolingDevices.map((device, index) => {
    const reported = pairByPosition
      ? thermalFans[index]
      : live.get(device.device);
    return {
      name: device.device,
      max: device.max_speed,
      live: reported?.present ? (reported.cur_state ?? null) : null,
      setpoint: device.speed,
      controllable: true,
      present: reported ? reported.present : true,
      // Only `type=thermal` carries the levels table. A fan `type=cooling`
      // knows and `type=thermal` does not therefore shows a step and no duty,
      // which is correct: nothing here has the table for it.
      levels: reported?.levels ?? null,
      maxLevel: reported?.max_level ?? null,
      canHold: device.overridden !== undefined && device.zone != null,
      overridden: device.overridden ?? false,
    };
  });

  // A fan the thermal endpoint knows and `type=cooling` does not still gets a
  // row. There is nothing to set on it, but leaving it out would hide a
  // running fan behind an endpoint mismatch.
  for (const fan of thermalFans) {
    const alreadyShown = pairByPosition
      ? coolingDevices.length > 0
      : rows.some((row) => row.name === fan.name);
    if (!alreadyShown) {
      rows.push({
        name: fan.name,
        max: fan.max_state ?? 0,
        live: fan.present ? (fan.cur_state ?? null) : null,
        setpoint: null,
        controllable: false,
        present: fan.present,
        levels: fan.levels ?? null,
        maxLevel: fan.max_level ?? null,
        // Nothing to command, so nothing to hold.
        canHold: false,
        overridden: false,
      });
    }
  }

  const sensors = thermal?.sensors ?? [];
  const ceiling = overrideCeiling(sensors);
  const measuring = sensors.some(
    (sensor) => sensor.present && isReading(sensor.temperature_c)
  );

  // "The kernel is driving this" is an inference, not a reading: a sensor the
  // board can read and a cooling device the thermal layer knows are what a
  // governor needs, but whether the device tree actually maps one to the
  // other is not something any endpoint reports. It is labelled as a standing
  // condition, and the notice below is the part that is measured.
  const governed = measuring && rows.some((row) => row.live !== null);

  // A commit is reverted when a poll that finished *after* it disagrees with
  // it. dataUpdatedAt is the timestamp of the last successful thermal fetch,
  // so this needs no timer and cannot fire on the read-back that still shows
  // the new value.
  const showGovernorNote =
    governed && rows.some((row) => row.controllable && !row.canHold);
  // The provenance note earns its space only where a duty is actually drawn.
  const showDutyNote = rows.some((row) => row.levels !== null);

  const reverted = rows.filter((row) => {
    const sent = committed[row.name];
    return (
      sent !== undefined &&
      row.live !== null &&
      dataUpdatedAt > sent.at &&
      row.live !== sent.step
    );
  });

  const reason = governorReason(sensors);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("info.healthTemperatureTerm")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {isPending && <ThermalSkeleton />}

          {isError && (
            <p className="text-sm text-muted-foreground">
              {t("info.thermalUnavailable")}
            </p>
          )}

          {thermal && sensors.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("info.thermalNoSensors")}
            </p>
          )}

          {sensors.map((sensor) => (
            <div key={sensor.name} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">
                  {sensor.name}
                </span>
                <span className="text-3xl font-semibold tabular-nums">
                  <SensorReading sensor={sensor} />
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {t("info.fanControl")}
            {showDutyNote && (
              <InfoNote
                text={t("info.fanDutyNote")}
                path="/features/see-what-the-board-sees/"
                label={t("info.fanControl")}
              />
            )}
          </CardTitle>
          {governed && (
            <CardAction>
              <Badge variant="secondary">
                {rows.some((row) => row.overridden)
                  ? t("info.fanHeld")
                  : t("info.fanAutomatic")}
              </Badge>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {rows.map((row) => {
            // The step being drawn, and the duty of that same step -- not of
            // the setpoint and not of anything else, so the numbers beside
            // each other always describe one position of one fan.
            const step = row.live ?? row.setpoint ?? 0;
            const duty = fanDutyPercent(row.levels, row.maxLevel, step);
            const stepLabel = t("info.fanStep", { cur: step, max: row.max });
            // Why the fan is where it is: the highest `active` trip the board
            // has crossed, shown only when the daemon reports the trips.
            const detail = [
              duty === null ? null : t("info.fanDuty", { value: duty }),
              reason === null
                ? null
                : t("info.fanAboveTrip", { celsius: reason }),
            ].filter((part): part is string => part !== null);

            return (
              <div key={row.name} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-muted-foreground">
                    {row.name}
                  </span>
                  {row.present && row.max > 0 ? (
                    <>
                      <span className="text-3xl font-semibold tabular-nums">
                        {stepLabel}
                      </span>
                      {detail.length > 0 && (
                        <span className="text-sm text-muted-foreground">
                          {detail.join(" · ")}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="font-medium text-warning">
                      {t("info.thermalAbsent")}
                    </span>
                  )}
                </div>

                {row.present && row.max > 0 && (
                  <StepBar
                    value={step}
                    max={row.max}
                    label={t("info.ariaFanStep", { device: row.name })}
                    valueText={[stepLabel, ...detail].join(" · ")}
                  />
                )}

                {/* The temperatures the step follows, beside the step, so
                    "4 of 6" reads as a consequence of the board's heat. */}
                {row.present &&
                  row.live !== null &&
                  sensors.map((sensor) => (
                    <TripScale key={sensor.name} sensor={sensor} />
                  ))}

                {row.controllable && row.canHold && (
                  <Field orientation="horizontal" className="items-start">
                    <Switch
                      id={`fan-override-${row.name}`}
                      checked={row.overridden}
                      onCheckedChange={(on) => {
                        // Turning the switch on must not move the fan. The
                        // step it is on now becomes the step it is held at,
                        // so the only thing that changes is who decides it.
                        const hold = row.live ?? row.setpoint ?? 0;
                        if (on) {
                          setRequested((previous) => ({
                            ...previous,
                            [row.name]: hold,
                          }));
                        } else {
                          // The governor is about to choose a step. Forget
                          // what was committed here, or the notice below
                          // would report the governor's own choice as the
                          // board overruling this page.
                          setCommitted((previous) => {
                            const next = { ...previous };
                            delete next[row.name];
                            return next;
                          });
                        }
                        setFan(
                          {
                            device: row.name,
                            speed: hold,
                            mode: on ? "manual" : "auto",
                          },
                          on
                        );
                      }}
                      aria-label={t("info.ariaFanOverride", {
                        device: row.name,
                      })}
                    />
                    <FieldContent>
                      <FieldLabel htmlFor={`fan-override-${row.name}`}>
                        {t("info.fanOverride")}
                      </FieldLabel>
                      <FieldDescription
                        className={cn(row.overridden && "text-warning")}
                      >
                        {row.overridden
                          ? t("info.fanOverrideOn") +
                            (ceiling !== null
                              ? ` ${t("info.fanOverrideCeiling", { celsius: ceiling })}`
                              : "")
                          : t("info.fanOverrideOff")}
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                )}

                {/* The slider is the default only on a daemon that cannot
                    hold a step; where it can, it appears with the switch. */}
                {row.controllable && (!row.canHold || row.overridden) && (
                  <div className="flex items-center gap-4">
                    <Slider
                      defaultValue={row.live ?? row.setpoint ?? 0}
                      min={0}
                      max={row.max}
                      aria-label={t("info.fanControl")}
                      onValueChange={(value) =>
                        setRequested((previous) => ({
                          ...previous,
                          [row.name]: single(value),
                        }))
                      }
                      onValueCommitted={(committed) => {
                        const value = single(committed);
                        setCommitted((previous) => ({
                          ...previous,
                          [row.name]: { step: value, at: Date.now() },
                        }));
                        setFan({
                          device: row.name,
                          speed: value,
                          mode: row.canHold ? "manual" : undefined,
                        });
                      }}
                    />
                    <span className="w-20 shrink-0 text-right text-sm text-muted-foreground">
                      {t("info.fanRequested", {
                        value: requested[row.name] ?? row.setpoint ?? 0,
                      })}
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          {showGovernorNote && (
            <p className="text-sm text-muted-foreground">
              {t("info.fanGovernorNote")}
            </p>
          )}

          {reverted.length > 0 && (
            <Alert variant="warning">
              <TriangleAlert />
              <AlertDescription>
                {reverted.map((row) => (
                  <p key={row.name}>
                    {t("info.fanReverted", {
                      device: row.name,
                      cur: row.live,
                      max: row.max,
                      requested: committed[row.name].step,
                    })}
                  </p>
                ))}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </>
  );
}
