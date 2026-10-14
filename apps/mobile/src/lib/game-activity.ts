import type { HeartRateSample, MotionSample } from "@holy-padel/db";
import type { GameSeries } from "@/lib/game-series.ts";

/** A slice of a match in wall-clock time. */
export interface ActivityWindow {
  readonly from: number;
  readonly to: number;
}

/** What the watch measured inside one window; a key is omitted when unmeasured. */
export interface WindowActivity {
  readonly steps?: number;
  readonly meters?: number;
  readonly avgBpm?: number;
  readonly maxBpm?: number;
}

/**
 * Each game's window runs from the end of the game before (the match start for
 * the first) to its own last rally — so the walk between rallies and the
 * change of ends count toward the game they lead into, and the windows tile
 * the match with no gaps or overlaps.
 */
export function gameWindows(
  series: readonly GameSeries[],
  matchStartedAt: number,
): ActivityWindow[] {
  return series.map((game, index) => ({
    from: Math.min(series[index - 1]?.endedAt ?? matchStartedAt, game.startedAt),
    to: game.endedAt,
  }));
}

/** The whole match as one window — the first game's start to the last game's end. */
export function matchWindow(
  series: readonly GameSeries[],
  matchStartedAt: number,
): ActivityWindow | undefined {
  const last = series.at(-1);
  return last === undefined ? undefined : { from: matchStartedAt, to: last.endedAt };
}

/**
 * Sum the movement deltas and summarise the heart rate inside a window. A
 * motion interval counts toward the window it ended in.
 */
export function activityIn(
  window: ActivityWindow,
  heartRate: readonly HeartRateSample[] | undefined,
  motion: readonly MotionSample[] | undefined,
): WindowActivity {
  const inside = (t: number): boolean => t > window.from && t <= window.to;
  let steps = 0;
  let meters = 0;
  let movement = false;
  for (const sample of motion ?? []) {
    if (inside(sample.t)) {
      movement = true;
      steps += sample.steps;
      meters += sample.meters;
    }
  }
  const bpms = (heartRate ?? []).filter((sample) => inside(sample.t)).map((s) => s.bpm);
  const total = bpms.reduce((sum, bpm) => sum + bpm, 0);
  return {
    ...(movement ? { steps: Math.round(steps) } : {}),
    ...(movement && meters > 0 ? { meters } : {}),
    ...(bpms.length > 0
      ? { avgBpm: Math.round(total / bpms.length), maxBpm: Math.max(...bpms) }
      : {}),
  };
}

/** "86 m" under a kilometre, "1.24 km" above. */
export function distanceLabel(meters: number): string {
  return meters < 1000 ? `${String(Math.round(meters))} m` : `${(meters / 1000).toFixed(2)} km`;
}

/** Longer than this between two readings is a real dropout, drawn as a break. */
export const HR_GAP_MS = 90_000;

function bpmAt(before: HeartRateSample, after: HeartRateSample, t: number): number {
  const span = after.t - before.t;
  return span <= 0 ? before.bpm : before.bpm + ((after.bpm - before.bpm) * (t - before.t)) / span;
}

/**
 * The heart-rate readings to draw across a window, as continuous runs. The
 * reading just outside each edge is interpolated onto the edge, so the line
 * reaches the start and end of the game instead of beginning at the first
 * reading inside it. A run only breaks where readings are more than
 * `HR_GAP_MS` apart — a real dropout — not between every pair of points.
 */
export function heartRateRuns(
  samples: readonly HeartRateSample[],
  window: ActivityWindow,
): HeartRateSample[][] {
  const sorted = [...samples].sort((left, right) => left.t - right.t);
  const inside = sorted.filter((sample) => sample.t >= window.from && sample.t <= window.to);
  const before = sorted.filter((sample) => sample.t < window.from).at(-1);
  const after = sorted.find((sample) => sample.t > window.to);
  const [first] = inside;
  const last = inside.at(-1);
  if (first === undefined) {
    // A short window can fall between two readings: bridge it when they're close.
    return before !== undefined && after !== undefined && after.t - before.t <= HR_GAP_MS
      ? [
          [
            { t: window.from, bpm: bpmAt(before, after, window.from) },
            { t: window.to, bpm: bpmAt(before, after, window.to) },
          ],
        ]
      : [];
  }
  const points: HeartRateSample[] = [];
  if (before !== undefined && first !== undefined && first.t - before.t <= HR_GAP_MS) {
    points.push({ t: window.from, bpm: bpmAt(before, first, window.from) });
  }
  points.push(...inside);
  if (after !== undefined && last !== undefined && after.t - last.t <= HR_GAP_MS) {
    points.push({ t: window.to, bpm: bpmAt(last, after, window.to) });
  }
  const runs: HeartRateSample[][] = [];
  for (const point of points) {
    const run = runs.at(-1);
    const previous = run?.at(-1);
    if (run === undefined || previous === undefined || point.t - previous.t > HR_GAP_MS) {
      runs.push([point]);
    } else {
      run.push(point);
    }
  }
  return runs.filter((run) => run.length >= 2);
}
