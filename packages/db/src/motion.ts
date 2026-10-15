import type { SqlDriver } from "./driver.ts";
import { getSetting, setSetting } from "./settings.ts";

/**
 * One interval of movement from the watch's workout tracking: the steps taken
 * and metres covered in the interval that ended at `t`. Deltas, not running
 * totals — summing the intervals inside a window gives that window's total,
 * which is how per-game steps and distance are computed.
 */
export interface MotionSample {
  /** Epoch milliseconds the interval ended. */
  readonly t: number;
  readonly steps: number;
  readonly meters: number;
}

const MAX_SAMPLES = 5000;
/** Sanity caps per interval — far above anything a human does in seconds. */
const MAX_STEPS = 2000;
const MAX_METERS = 2000;

const storageKey = (matchId: string): string => `motion:${matchId}`;

function isNonNegative(value: unknown, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max;
}

/** Plausible intervals only — a malformed one is dropped, not half-kept. */
export function parseMotionSamples(value: unknown): MotionSample[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: MotionSample[] = [];
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) {
      continue;
    }
    const { t, steps, meters } = raw as {
      readonly t?: unknown;
      readonly steps?: unknown;
      readonly meters?: unknown;
    };
    if (
      typeof t === "number" &&
      Number.isFinite(t) &&
      isNonNegative(steps, MAX_STEPS) &&
      isNonNegative(meters, MAX_METERS)
    ) {
      out.push({ t, steps, meters });
    }
  }
  return out.slice(0, MAX_SAMPLES);
}

/** Store the watch-tracked movement series for a match (re-saves replace it). */
export function saveMatchMotion(
  driver: SqlDriver,
  matchId: string,
  samples: readonly MotionSample[],
): void {
  if (samples.length === 0) {
    return;
  }
  setSetting(
    driver,
    storageKey(matchId),
    JSON.stringify({ samples: samples.slice(0, MAX_SAMPLES) }),
  );
}

/** The stored movement series for a match; undefined when none was tracked. */
export function loadMatchMotion(
  driver: SqlDriver,
  matchId: string,
): readonly MotionSample[] | undefined {
  const raw = getSetting(driver, storageKey(matchId));
  if (raw === undefined) {
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  const samples =
    typeof parsed === "object" && parsed !== null
      ? parseMotionSamples((parsed as { readonly samples?: unknown }).samples)
      : [];
  return samples.length > 0 ? samples : undefined;
}
