import type { SqlDriver } from "@holy-padel/db";
import {
  appendEvent,
  createMatch,
  getLiveMatch,
  listMatches,
  removeLastEvent,
} from "@holy-padel/db";

/** The watch → phone intents (docs/watch-sync.md). */
export const INTENT_PATHS = {
  score: "/holy-padel/score",
  undo: "/holy-padel/undo",
  startLast: "/holy-padel/start-last",
} as const;

export interface WatchIntent {
  readonly path: string;
  readonly body: string;
}

export interface IntentContext {
  /** Epoch ms for the appended event / new match. */
  readonly now: number;
  /** Fresh id for a rematch. */
  readonly newMatchId: () => string;
}

/**
 * Applies one watch intent to the ledger, mirroring the live screen's own
 * score / undo / rematch actions so the watch drives the exact same mutations —
 * the phone stays the single writer. Unknown paths and impossible states
 * (scoring with no live match, rematching mid-match) are no-ops.
 */
export function applyWatchIntent(driver: SqlDriver, intent: WatchIntent, ctx: IntentContext): void {
  if (intent.path === INTENT_PATHS.score) {
    if (intent.body !== "A" && intent.body !== "B") {
      return;
    }
    const live = getLiveMatch(driver);
    if (live !== undefined) {
      appendEvent(driver, live.id, { winner: intent.body, at: ctx.now });
    }
    return;
  }

  if (intent.path === INTENT_PATHS.undo) {
    const live = getLiveMatch(driver);
    if (live !== undefined) {
      removeLastEvent(driver, live.id);
    }
    return;
  }

  if (intent.path === INTENT_PATHS.startLast) {
    if (getLiveMatch(driver) !== undefined) {
      return;
    }
    const last = listMatches(driver).find((match) => match.status === "finished");
    if (last === undefined) {
      return;
    }
    createMatch(driver, {
      id: ctx.newMatchId(),
      config: last.config,
      players: last.players,
      ...(last.court === undefined ? {} : { court: last.court }),
      ...(last.location === undefined ? {} : { location: last.location }),
      startedAt: ctx.now,
    });
  }
}
