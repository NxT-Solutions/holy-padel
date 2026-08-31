import type { SqlDriver } from "./driver.ts";
import { getSetting, setSetting } from "./settings.ts";

/** One heart-rate reading from the watch's workout tracking. */
export interface HeartRateSample {
  /** Epoch milliseconds. */
  readonly t: number;
  readonly bpm: number;
}

const MAX_SAMPLES = 3000;

const storageKey = (matchId: string): string => `hr:${matchId}`;

/** Physically plausible readings only — a malformed sample is dropped. */
function parseSamples(value: unknown): HeartRateSample[] | undefined {
  if (typeof value !== "object" || value === null) {
    return;
  }
  const samples = (value as { samples?: unknown }).samples;
  if (!Array.isArray(samples)) {
    return;
  }
  const out: HeartRateSample[] = [];
  for (const raw of samples) {
    if (typeof raw !== "object" || raw === null) {
      continue;
    }
    const { t, bpm } = raw as { readonly t?: unknown; readonly bpm?: unknown };
    if (
      typeof t === "number" &&
      Number.isFinite(t) &&
      typeof bpm === "number" &&
      Number.isFinite(bpm) &&
      bpm > 20 &&
      bpm < 260
    ) {
      out.push({ t, bpm });
    }
  }
  return out.length > 0 ? out.slice(0, MAX_SAMPLES) : undefined;
}

/**
 * Store the watch-tracked heart-rate series for a match. Workouts arrive once
 * per match; re-saves replace the stored series.
 */
export function saveMatchHeartRate(
  driver: SqlDriver,
  matchId: string,
  samples: readonly HeartRateSample[],
): void {
  if (samples.length === 0) {
    return;
  }
  setSetting(
    driver,
    storageKey(matchId),
    JSON.stringify({
      samples: samples.slice(0, MAX_SAMPLES),
    }),
  );
}

/** The stored heart-rate series for a match; undefined when none was tracked. */
export function loadMatchHeartRate(
  driver: SqlDriver,
  matchId: string,
): readonly HeartRateSample[] | undefined {
  const raw = getSetting(driver, storageKey(matchId));
  if (raw === undefined) {
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = undefined;
  }
  return parseSamples(parsed);
}
