import type { SqlDriver } from "@holy-padel/db";
import { listMatches, saveMatchHeartRate } from "@holy-padel/db";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { useDbMutation, useDbQuery } from "@/db/provider.tsx";
import { logWatchWorkout } from "@/health/health-log.ts";
import { parseWorkoutSummary, WORKOUT_PATH } from "@/health/watch-workout.ts";
import { newMatchId } from "@/lib/navigation.ts";
import { applyWatchIntent } from "./apply-intent.ts";
import { addIntentListener, pushWatchStateJson } from "./bridge.ts";
import { buildWatchState } from "./build-state.ts";
import { gatherWatchInput } from "./gather-input.ts";

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

/**
 * Keeps the watches in sync with the live match: rebuilds and pushes the state
 * payload on every ledger change (and on a slow clock tick), and applies the
 * score / undo / rematch intents the watch sends back through the same writes
 * the live screen uses. A no-op when no watch bridge is linked (see bridge.ts).
 *
 * The clock is stamped with a fresh `Date.now()` at push time, never a ticking
 * state: scoring from the watch while the phone is pocketed (backgrounded, no
 * JS timers) must still advance the watch's match clock on every point.
 */
export function useWatchSync(): void {
  const mutate = useDbMutation();
  // Re-gathered on every ledger change; `now` ages out a held MATCH WON.
  const input = useDbQuery((driver) => gatherWatchInput(driver, Date.now()));
  const inputRef = useRef(input);
  inputRef.current = input;

  useEffect(() => {
    pushWatchStateJson(JSON.stringify(buildWatchState({ ...input, now: Date.now() })));
  }, [input]);

  // Foreground heartbeat: advances the watch clock between ledger changes.
  useEffect(() => {
    const timer = setInterval(() => {
      pushWatchStateJson(JSON.stringify(buildWatchState({ ...inputRef.current, now: Date.now() })));
    }, CLOCK_REFRESH_MS);
    return (): void => {
      clearInterval(timer);
    };
  }, []);

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
