import type { SqlDriver } from "@holy-padel/db";
import { finishMatch, getMatch, loadEvents } from "@holy-padel/db";
import { computeMatch } from "@holy-padel/scoring";
import { currentLeader, finalScoreLine, liveScoreLine } from "@/lib/format.ts";

/**
 * Stop AND save a match in whatever state it's in — the "court time's up, don't
 * lose the score" path. A truly finished match keeps the engine's winner and
 * final line; a match stopped mid-play is credited to whoever's ahead so the
 * partial result still counts.
 *
 * Shared by the phone's END sheet and the watch's stop intent so both surfaces
 * persist byte-identically — the phone stays the single writer either way.
 * No-op if the match is already gone.
 */
export function stopAndSaveMatch(driver: SqlDriver, id: string, at: number): void {
  const match = getMatch(driver, id);
  if (match === undefined) {
    return;
  }
  const snapshot = computeMatch(match.config, loadEvents(driver, id));
  finishMatch(driver, id, {
    winner: snapshot.winner ?? currentLeader(snapshot),
    endedAt: at,
    scoreLine: snapshot.finished ? finalScoreLine(snapshot) : liveScoreLine(snapshot),
  });
}
