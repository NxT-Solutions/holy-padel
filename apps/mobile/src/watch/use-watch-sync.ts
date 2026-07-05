import type { SqlDriver } from "@holy-padel/db";
import { getLiveMatch, listMatches, loadEvents } from "@holy-padel/db";
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

// The app treats "nico" as the device owner throughout (see the matches screen).
const OWNER_ID = "nico";
const CLOCK_REFRESH_MS = 30_000;

type GatheredInput = Pick<WatchStateInput, "ownerId" | "live" | "last">;

function gatherWatchInput(driver: SqlDriver): GatheredInput {
  const live = getLiveMatch(driver);
  if (live !== undefined) {
    const snapshot = computeMatch(live.config, loadEvents(driver, live.id));
    return { ownerId: OWNER_ID, live: { match: live, snapshot } };
  }
  const last = listMatches(driver).find((match) => match.status === "finished");
  return last === undefined ? { ownerId: OWNER_ID } : { ownerId: OWNER_ID, last };
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
          // A tracked workout summary, not a scoring intent: persist it to the
          // health platform (fire-and-forget) — the ledger is untouched.
          const summary = parseWorkoutSummary(intent.body);
          if (summary !== undefined) {
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
