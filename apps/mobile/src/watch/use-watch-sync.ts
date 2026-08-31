import type { SqlDriver } from "@holy-padel/db";
import {
  getLiveMatch,
  getOwner,
  listMatches,
  loadEvents,
  saveMatchHeartRate,
} from "@holy-padel/db";
import { computeMatch } from "@holy-padel/scoring";
import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { useDbMutation, useDbQuery } from "@/db/provider.tsx";
import { logWatchWorkout } from "@/health/health-log.ts";
import { parseWorkoutSummary, WORKOUT_PATH } from "@/health/watch-workout.ts";
import { newMatchId } from "@/lib/navigation.ts";
import { useNow } from "@/lib/use-now.ts";
import { applyWatchIntent } from "./apply-intent.ts";
import { addIntentListener, pushWatchStateJson } from "./bridge.ts";
import type { WatchStateInput } from "./build-state.ts";
import { buildWatchState } from "./build-state.ts";

const CLOCK_REFRESH_MS = 30_000;

/** Longest reasonable gap between a match's start and its tracked workout. */
const WORKOUT_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * The match a workout summary belongs to: the most recent match that started
 * within a day of the tracked session (the watch sends no match id).
 */
export function matchIdForWorkout(driver: SqlDriver, startedAt: number): string | undefined {
  let best: { readonly id: string; readonly gap: number } | undefined;
  for (const match of listMatches(driver)) {
    const gap = Math.abs(match.startedAt - startedAt);
    if (gap <= WORKOUT_WINDOW_MS && (best === undefined || gap < best.gap)) {
      best = { id: match.id, gap };
    }
  }
  return best?.id;
}

type GatheredInput = Pick<WatchStateInput, "ownerId" | "live" | "last">;

function gatherWatchInput(driver: SqlDriver): GatheredInput {
  const owner = getOwner(driver);
  const ownerId = owner === undefined ? "nico" : owner.id;
  const live = getLiveMatch(driver);
  if (live !== undefined) {
    const snapshot = computeMatch(live.config, loadEvents(driver, live.id));
    return { ownerId, live: { match: live, snapshot } };
  }
  const last = listMatches(driver).find((match) => match.status === "finished");
  return last === undefined ? { ownerId } : { ownerId, last };
}

/**
 * Keeps the watches in sync with the live match: rebuilds and pushes the state
 * payload on every ledger change (and on a slow clock tick), and applies the
 * score / undo / rematch intents the watch sends back through the same writes
 * the live screen uses. A no-op when no watch bridge is linked (see bridge.ts).
 */
export function useWatchSync(): void {
  const mutate = useDbMutation();
  const now = useNow(CLOCK_REFRESH_MS);
  const input = useDbQuery(gatherWatchInput);

  const json = useMemo(() => JSON.stringify(buildWatchState({ ...input, now })), [input, now]);

  useEffect(() => {
    pushWatchStateJson(json);
  }, [json]);

  useEffect(
    () =>
      addIntentListener((intent) => {
        if (intent.path === WORKOUT_PATH) {
          // A tracked workout summary, not a scoring intent: keep the
          // heart-rate series for the match it belongs to (the score-race
          // overlay reads it back), and mirror the workout into the health
          // platform (fire-and-forget) — the ledger is untouched.
          const summary = parseWorkoutSummary(intent.body);
          if (summary !== undefined) {
            mutate((driver) => {
              const matchId = matchIdForWorkout(driver, summary.startedAt);
              if (matchId !== undefined) {
                saveMatchHeartRate(
                  driver,
                  matchId,
                  summary.samples.map((sample) => ({ t: sample.t, bpm: sample.bpm })),
                );
              }
            });
            void logWatchWorkout(JSON.stringify(summary));
          }
          return;
        }
        mutate((driver) => {
          applyWatchIntent(driver, intent, { now: Date.now(), newMatchId });
        });
      }),
    [mutate],
  );
}

/** Mount once inside DbProvider to run the sync for the app's lifetime. */
export function WatchSync(): ReactNode {
  useWatchSync();
  return null;
}
