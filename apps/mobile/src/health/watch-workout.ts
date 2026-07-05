/**
 * The workout summary a watch sends after a tracked match — the body of a
 * `/holy-padel/workout` Data Layer message (docs/watch-sync.md). Parsed
 * defensively: a malformed summary is dropped rather than half-written.
 */

export const WORKOUT_PATH = "/holy-padel/workout";

export interface WatchWorkoutSummary {
  readonly startedAt: number;
  readonly endedAt: number;
  readonly kcal: number;
  readonly avgBpm: number;
  readonly maxBpm: number;
  readonly samples: readonly { readonly t: number; readonly bpm: number }[];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function numberOr(value: unknown, fallback: number): number {
  return isFiniteNumber(value) ? value : fallback;
}

function parseSamples(value: unknown): { t: number; bpm: number }[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((sample: unknown) => {
    if (typeof sample !== "object" || sample === null) {
      return [];
    }
    const record = sample as Record<string, unknown>;
    const t = record["t"];
    const bpm = record["bpm"];
    return isFiniteNumber(t) && isFiniteNumber(bpm) && bpm > 0 ? [{ t, bpm }] : [];
  });
}

/** Parse a summary body; undefined when it isn't a usable workout. */
export function parseWorkoutSummary(body: string): WatchWorkoutSummary | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return;
  }
  if (typeof raw !== "object" || raw === null) {
    return;
  }
  const record = raw as Record<string, unknown>;
  const startedAt = record["startedAt"];
  const endedAt = record["endedAt"];
  if (!(isFiniteNumber(startedAt) && isFiniteNumber(endedAt)) || endedAt <= startedAt) {
    return;
  }
  const kcal = numberOr(record["kcal"], 0);
  const samples = parseSamples(record["samples"]);
  if (kcal <= 0 && samples.length === 0) {
    // Nothing measurable — not worth a health entry.
    return;
  }
  return {
    startedAt,
    endedAt,
    kcal,
    avgBpm: numberOr(record["avgBpm"], 0),
    maxBpm: numberOr(record["maxBpm"], 0),
    samples,
  };
}
