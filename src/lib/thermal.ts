import type { ThermalSensor } from "@/lib/api/get";
import { isReading } from "@/lib/format";

/**
 * The highest `active` trip the board is above, or null.
 *
 * That is the one the step_wise governor is responding to, so it is what
 * explains the fan's current step. Null when the daemon reports no trips (an
 * older bmcd), when nothing can be read, or when the board is below every
 * trip — in which case there is nothing to explain.
 *
 * Lives here rather than in FanControl because two places need it now: the
 * fan card, and Board Health, which reads the same sensor without offering
 * any control over it.
 */
export function governorReason(sensors: ThermalSensor[]): number | null {
  let highest: number | null = null;
  for (const sensor of sensors) {
    if (!sensor.present || !sensor.trips) continue;
    for (const trip of sensor.trips) {
      if (trip.kind !== "active" || !isReading(trip.temperature_c)) continue;
      if (!isReading(sensor.temperature_c)) continue;
      if (sensor.temperature_c < trip.temperature_c) continue;
      if (highest === null || trip.temperature_c > highest) {
        highest = trip.temperature_c;
      }
    }
  }
  return highest;
}

/** The hottest reading any present sensor reports, or null. */
export function hottestReading(sensors: ThermalSensor[]): number | null {
  let hottest: number | null = null;
  for (const sensor of sensors) {
    if (!sensor.present || !isReading(sensor.temperature_c)) continue;
    if (hottest === null || sensor.temperature_c > hottest) {
      hottest = sensor.temperature_c;
    }
  }
  return hottest;
}

/**
 * Kernel thermal-zone names, as a reader would call the part they measure.
 *
 * The daemon passes the zone's `type` through from the device tree, and
 * "bmc-thermal" is a node name, not a label. A name missing from here is
 * shown as the board sent it rather than guessed at.
 */
const SENSOR_LABELS: Record<string, string> = {
  "bmc-thermal": "BMC",
};

export function sensorLabel(name: string): string {
  return SENSOR_LABELS[name] ?? name;
}
