import type { SqlDriver } from "@holy-padel/db";
import {
  getLiveMatch,
  getOwner,
  getSetting,
  listMatches,
  loadEvents,
  setSetting,
} from "@holy-padel/db";
import { computeMatch } from "@holy-padel/scoring";
import type { WatchStateInput } from "./build-state.ts";

/** The finished match whose MATCH WON screen the watch has dismissed. */
const WON_ACK_KEY = "watchWonAck";

/**
 * How long a just-won match keeps the watch on MATCH WON when nobody taps DONE.
 * Measured when the payload is gathered (every ledger change and app start).
 */
export const WON_HOLD_MS = 30 * 60 * 1000;

export type GatheredInput = Pick<WatchStateInput, "ownerId" | "live" | "last">;

/**
 * Dismiss the watch's MATCH WON screen for the latest finished match — the
 * watch's DONE, or the phone's. The result itself was saved by the deciding
 * rally; this only sends the watch back to idle.
 */
export function acknowledgeWon(driver: SqlDriver): void {
  const last = listMatches(driver).find((match) => match.status === "finished");
  if (last !== undefined) {
    setSetting(driver, WON_ACK_KEY, last.id);
  }
}

/**
 * What the phone mirrors to the watches. The live match when there is one.
 * Otherwise a match that was just won (decided by its rallies, not stopped
 * mid-play) is held as `live` so the watch shows MATCH WON — the match is saved
 * the moment it's decided, and without the hold the watch would skip straight
 * to idle. The hold ends on DONE (either surface), a new match, or
 * `WON_HOLD_MS`. Else idle, with the last result as the quick-start hint.
 */
export function gatherWatchInput(driver: SqlDriver, now: number): GatheredInput {
  const owner = getOwner(driver);
  const ownerId = owner === undefined ? "nico" : owner.id;
  const live = getLiveMatch(driver);
  if (live !== undefined) {
    const snapshot = computeMatch(live.config, loadEvents(driver, live.id));
    return { ownerId, live: { match: live, snapshot } };
  }
  const last = listMatches(driver).find((match) => match.status === "finished");
  if (last === undefined) {
    return { ownerId };
  }
  const fresh = now - (last.endedAt ?? 0) <= WON_HOLD_MS;
  if (fresh && getSetting(driver, WON_ACK_KEY) !== last.id) {
    const snapshot = computeMatch(last.config, loadEvents(driver, last.id));
    if (snapshot.finished) {
      return { ownerId, live: { match: last, snapshot } };
    }
  }
  return { ownerId, last };
}
