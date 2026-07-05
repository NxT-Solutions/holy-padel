import type { SqlDriver } from "@holy-padel/db";
import {
  createMatch,
  deleteMatch,
  getLiveMatch,
  listMatches,
  pauseMatch,
  removeLastEvent,
  resumeMatch,
  scorePoint,
} from "@holy-padel/db";
import { stopAndSaveMatch } from "@/lib/match-actions.ts";

/** The watch → phone intents (docs/watch-sync.md). */
export const INTENT_PATHS = {
  score: "/holy-padel/score",
  undo: "/holy-padel/undo",
  startLast: "/holy-padel/start-last",
  pause: "/holy-padel/pause",
  /** Stop AND save the match in its current state (even unfinished). */
  stop: "/holy-padel/stop",
  /** Discard the match — lose it. */
  cancel: "/holy-padel/cancel",
  /** Back-compat alias for `stop` (older watch builds sent this). */
  end: "/holy-padel/end",
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

function applyScore(driver: SqlDriver, body: string, now: number): void {
  if (body !== "A" && body !== "B") {
    return;
  }
  const live = getLiveMatch(driver);
  // scorePoint re-reads fresh state and refuses if paused/finished, so a burst
  // of fast watch taps can't append past match point.
  if (live !== undefined) {
    scorePoint(driver, live.id, body, now);
  }
}

function applyUndo(driver: SqlDriver): void {
  const live = getLiveMatch(driver);
  if (live !== undefined) {
    removeLastEvent(driver, live.id);
  }
}

function applyPauseToggle(driver: SqlDriver, now: number): void {
  const live = getLiveMatch(driver);
  if (live === undefined) {
    return;
  }
  // A single intent toggles: pause when running, resume when paused.
  if (live.pausedAt === undefined) {
    pauseMatch(driver, live.id, now);
  } else {
    resumeMatch(driver, live.id, now);
  }
}

/**
 * Stop AND save the live match in whatever state it's in — the "court time's up,
 * don't lose the score" path. Shares `stopAndSaveMatch` with the phone's END
 * sheet so both surfaces persist identically. The match then leaves "live" and
 * the watch returns to idle.
 */
function applyStop(driver: SqlDriver, now: number): void {
  const live = getLiveMatch(driver);
  if (live === undefined) {
    return;
  }
  stopAndSaveMatch(driver, live.id, now);
}

/** Discard the live match entirely — nothing is saved. */
function applyCancel(driver: SqlDriver): void {
  const live = getLiveMatch(driver);
  if (live === undefined) {
    return;
  }
  deleteMatch(driver, live.id);
}

function applyStartLast(driver: SqlDriver, ctx: IntentContext): void {
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

/**
 * Applies one watch intent to the ledger, mirroring the live screen's own
 * score / undo / pause / rematch actions so the watch drives the exact same
 * mutations — the phone stays the single writer. Unknown paths and impossible
 * states (scoring with no live match, rematching mid-match) are no-ops.
 */
export function applyWatchIntent(driver: SqlDriver, intent: WatchIntent, ctx: IntentContext): void {
  if (intent.path === INTENT_PATHS.score) {
    applyScore(driver, intent.body, ctx.now);
  } else if (intent.path === INTENT_PATHS.undo) {
    applyUndo(driver);
  } else if (intent.path === INTENT_PATHS.pause) {
    applyPauseToggle(driver, ctx.now);
  } else if (intent.path === INTENT_PATHS.stop || intent.path === INTENT_PATHS.end) {
    applyStop(driver, ctx.now);
  } else if (intent.path === INTENT_PATHS.cancel) {
    applyCancel(driver);
  } else if (intent.path === INTENT_PATHS.startLast) {
    applyStartLast(driver, ctx);
  }
}
