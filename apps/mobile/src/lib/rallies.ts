import type { MatchConfig, PointEvent, TeamId } from "@holy-padel/scoring";
import { replayMatch } from "@holy-padel/scoring";
import type { Tally } from "@/lib/clutch.ts";

/**
 * Quicker than this, a rally can't have been served, played and scored — it's
 * almost surely a double tap, so it's left out.
 */
export const MIN_RALLY_MS = 4000;
/** Longer than this, the gap held a break (a drink, a chat), not one rally. */
export const MAX_RALLY_MS = 180_000;
/** The long cut-off never drops below this, so a genuinely long rally stays in. */
const LONG_FLOOR_MS = 60_000;
/** From this many rallies, unusually long gaps are judged against the match itself. */
const FENCE_MIN_RALLIES = 8;

/** One timed rally, from your side. */
export interface Rally {
  readonly ms: number;
  readonly won: boolean;
}

export interface RallyLengths {
  /** The rallies kept, in play order. */
  readonly rallies: readonly Rally[];
  /** Left out as too quick to be real — likely a double tap. */
  readonly tooShort: number;
  /** Left out as too long to be one rally — a break in between. */
  readonly tooLong: number;
}

export const NO_RALLIES: RallyLengths = { rallies: [], tooShort: 0, tooLong: 0 };

function quantile(sorted: readonly number[], q: number): number {
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position);
  const lower = sorted[low] ?? 0;
  const upper = sorted[Math.min(low + 1, sorted.length - 1)] ?? lower;
  return lower + (upper - lower) * (position - low);
}

/**
 * The longest a rally may run in this match: three interquartile ranges past
 * the upper quartile (a "far out" gap), kept between a minute and three.
 */
function longCutoff(lengths: readonly number[]): number {
  if (lengths.length < FENCE_MIN_RALLIES) {
    return MAX_RALLY_MS;
  }
  const sorted = [...lengths].sort((left, right) => left - right);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  return Math.min(MAX_RALLY_MS, Math.max(LONG_FLOOR_MS, q3 + 3 * (q3 - q1)));
}

/**
 * How long each rally ran, timed from one scored point to the next. The first
 * rally of every game is left out — its gap holds the changeover or the break
 * between games — and so are the outliers: anything under `MIN_RALLY_MS` (a
 * double tap) and anything implausibly long for this match (a break).
 */
export function rallyLengths(
  config: MatchConfig,
  events: readonly PointEvent[],
  team: TeamId,
): RallyLengths {
  const snapshots = replayMatch(config, events);
  const timed: Rally[] = [];
  let previousAt: number | undefined;
  let previousGame: string | undefined;
  events.forEach((event, index) => {
    const before = snapshots[index];
    if (event.kind === "serve" || before === undefined || before.finished) {
      return;
    }
    const { A, B } = before.totalGames;
    const game = `${String(before.setNumber)}:${String(A + B)}`;
    if (previousAt !== undefined && game === previousGame) {
      timed.push({ ms: event.at - previousAt, won: event.winner === team });
    }
    previousAt = event.at;
    previousGame = game;
  });
  const plausible = timed.filter((rally) => rally.ms >= MIN_RALLY_MS);
  const cutoff = longCutoff(plausible.map((rally) => rally.ms));
  const rallies = plausible.filter((rally) => rally.ms <= cutoff);
  return {
    rallies,
    tooShort: timed.length - plausible.length,
    tooLong: plausible.length - rallies.length,
  };
}

export function addRallies(left: RallyLengths, right: RallyLengths): RallyLengths {
  return {
    rallies: [...left.rallies, ...right.rallies],
    tooShort: left.tooShort + right.tooShort,
    tooLong: left.tooLong + right.tooLong,
  };
}

/** Enough rallies to say something about them. */
export const MIN_SUMMARY_RALLIES = 6;

export interface RallySummary {
  readonly count: number;
  readonly averageMs: number;
  readonly longestMs: number;
  /** The middle length — rallies over it are the long half. */
  readonly medianMs: number;
  /** Rallies longer than the median: won = won by you. */
  readonly long: Tally;
  /** Rallies at or under the median. */
  readonly short: Tally;
}

/** Average, longest, and how you do in the long half against the short half. */
export function summarizeRallies(rallies: readonly Rally[]): RallySummary | undefined {
  if (rallies.length < MIN_SUMMARY_RALLIES) {
    return;
  }
  const lengths = rallies.map((rally) => rally.ms).sort((left, right) => left - right);
  const medianMs = quantile(lengths, 0.5);
  const tally = (long: boolean): Tally => {
    const half = rallies.filter((rally) => rally.ms > medianMs === long);
    return { won: half.filter((rally) => rally.won).length, of: half.length };
  };
  return {
    count: rallies.length,
    averageMs: lengths.reduce((sum, ms) => sum + ms, 0) / lengths.length,
    longestMs: lengths.at(-1) ?? 0,
    medianMs,
    long: tally(true),
    short: tally(false),
  };
}

/** "14s", or "1:05" past the minute. */
export function rallyLengthLabel(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) {
    return `${String(seconds)}s`;
  }
  return `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Which rallies were left out and why, or undefined when none were. */
export function leftOutLabel(lengths: RallyLengths): string | undefined {
  const parts = [
    ...(lengths.tooShort === 0
      ? []
      : [
          `${String(lengths.tooShort)} under ${String(MIN_RALLY_MS / 1000)}s left out as likely double taps`,
        ]),
    ...(lengths.tooLong === 0
      ? []
      : [
          lengths.tooLong === 1
            ? "1 left out as a break, not a rally"
            : `${String(lengths.tooLong)} left out as breaks, not rallies`,
        ]),
  ];
  return parts.length === 0 ? undefined : `${parts.join(" · ")}.`;
}
