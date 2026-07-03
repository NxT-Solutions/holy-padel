import type { DeuceMode, TeamId, ThirdSetMode } from "./types.ts";

/** Points needed to win a standard game before deuce rules kick in. */
export const GAME_TARGET = 4;
/** Games needed to win a set (with a two-game margin). */
export const SET_TARGET = 6;
/** Games in a 7-5 or 7-6 set — the hard ceiling of a tie-break set. */
export const EXTENDED_SET_TARGET = 7;
/** Points target of the tie-break played at 6-6 (FIP Rule 1, Tie-break pt 2). */
export const TIE_BREAK_TARGET = 7;
/** Points target of the match-deciding super tie-break (FIP Alternative Score Methods 1c). */
export const SUPER_TIE_BREAK_TARGET = 10;
/** Margin required to win a game from deuce, a set from 5-5, or any tie-break. */
export const WIN_BY_TWO = 2;
/** Points each pair needs for deuce to be called. */
export const DEUCE_POINTS = 3;
/** Point counts at which the star-point deciding rally is reached (deuce 3). */
export const STAR_POINT_POINTS = 5;

export function otherTeam(team: TeamId): TeamId {
  return team === "A" ? "B" : "A";
}

/**
 * Has a standard game been won at `winnerPoints`–`loserPoints`?
 * Point counts are raw rally tallies (0, 1, 2, …), not calls.
 */
export function standardGameWon(
  mode: DeuceMode,
  winnerPoints: number,
  loserPoints: number,
): boolean {
  switch (mode) {
    case "advantage":
      return winnerPoints >= GAME_TARGET && winnerPoints - loserPoints >= WIN_BY_TWO;
    case "goldenPoint":
      // The first deuce (3-3) is decided by a single golden point, so 4 always wins.
      return winnerPoints >= GAME_TARGET;
    case "starPoint":
      // Two advantage cycles, then deuce 3 (5-5) is decided by a single star point.
      return (
        (winnerPoints >= GAME_TARGET && winnerPoints - loserPoints >= WIN_BY_TWO) ||
        winnerPoints > STAR_POINT_POINTS
      );
    default: {
      const unreachable: never = mode;
      throw new Error(`unknown deuce mode: ${String(unreachable)}`);
    }
  }
}

/** Is the next rally the single deciding point of the game (golden or star point)? */
export function isDecidingPoint(mode: DeuceMode, pointsA: number, pointsB: number): boolean {
  if (mode === "goldenPoint") {
    return pointsA === DEUCE_POINTS && pointsB === DEUCE_POINTS;
  }
  if (mode === "starPoint") {
    return pointsA === STAR_POINT_POINTS && pointsB === STAR_POINT_POINTS;
  }
  return false;
}

/** Does a set stand won at `winnerGames`–`loserGames` under normal set rules? */
export function setWon(winnerGames: number, loserGames: number, withTieBreak: boolean): boolean {
  if (winnerGames >= SET_TARGET && winnerGames - loserGames >= WIN_BY_TWO) {
    return true;
  }
  // 7-5 is reached through the margin rule above; 7-6 only via the tie-break game.
  return withTieBreak && winnerGames === EXTENDED_SET_TARGET && loserGames === SET_TARGET;
}

/** Do the current games force a tie-break (6-6)? */
export function tieBreakDue(gamesA: number, gamesB: number, withTieBreak: boolean): boolean {
  return withTieBreak && gamesA === SET_TARGET && gamesB === SET_TARGET;
}

/** Has a tie-break to `target` points been won (two clear, unbounded)? */
export function tieBreakWon(target: number, winnerPoints: number, loserPoints: number): boolean {
  return winnerPoints >= target && winnerPoints - loserPoints >= WIN_BY_TWO;
}

/**
 * Which team serves tie-break point `pointIndex` (0-based), given the team
 * that started the tie-break. FIP pattern: 1 point, then 2 points per server,
 * alternating pairs (1, 2, 2, 2, …).
 */
export function tieBreakServer(starter: TeamId, pointIndex: number): TeamId {
  const serverBlock = Math.floor((pointIndex + 1) / WIN_BY_TWO);
  return serverBlock % WIN_BY_TWO === 0 ? starter : otherTeam(starter);
}

/** Does the third set of this configuration run without a tie-break? */
export function thirdSetWithoutTieBreak(mode: ThirdSetMode): boolean {
  return mode === "advantageSet";
}

/** Sets a team must win to take the match. */
export function setsToWin(bestOf: 1 | 3): number {
  return bestOf === 1 ? 1 : WIN_BY_TWO;
}
