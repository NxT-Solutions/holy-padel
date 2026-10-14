import type { FoldState } from "./internal.ts";
import { bump, completeSet, ZERO } from "./internal.ts";
import { otherTeam, pbGameWon, squashGameWon } from "./rules.ts";
import type { MatchConfig, SetSummary, TeamId } from "./types.ts";

/*
 * Squash + pickleball fold application, and the snapshot-derivation helpers
 * shared by all sports (moments, point calls, serving team/side).
 */

export function applySquashPoint(
  state: FoldState,
  config: MatchConfig,
  rally: { readonly winner: TeamId; readonly gameSet: "one" | "two" | undefined },
): FoldState {
  const { winner, gameSet } = rally;
  if (config.sport !== "squash") {
    throw new Error("applySquashPoint called for padel match");
  }
  const isPar = config.squashMode === "par";
  const baseTarget = config.squashTarget;
  const choiceMode = config.squashTiebreak === "choice";
  const atChoicePoint = state.points.A === baseTarget - 1 && state.points.B === baseTarget - 1;
  // The receiver's decision rides on the rally played at the choice point:
  // "one" keeps the game at its target, "two" extends it by one point.
  const gameTarget = decideGameTarget(state, {
    choiceMode,
    atChoicePoint,
    baseTarget,
    gameSet,
  });
  const target = choiceMode ? (gameTarget ?? baseTarget) : baseTarget;
  const tiebreak = config.squashTiebreak === "choice" ? ("setOne" as const) : config.squashTiebreak;
  const points = isPar || winner === state.gameServer ? bump(state.points, winner) : state.points;
  const loser = otherTeam(winner);

  const serverConsecutivePoints =
    winner === state.gameServer ? state.serverConsecutivePoints + 1 : 0;

  if (!squashGameWon(tiebreak, target, points[winner], points[loser])) {
    return {
      ...state,
      points,
      gameServer: winner,
      serverConsecutivePoints,
      gameTarget,
    };
  }

  const summary: SetSummary = { games: points, winner, kind: "set" };
  const afterGame: FoldState = {
    ...state,
    points: ZERO,
    gameServer: winner,
    serverConsecutivePoints: 0,
    gameTarget: undefined,
    totalGames: bump(state.totalGames, winner),
  };
  return completeSet(afterGame, config, summary);
}

function decideGameTarget(
  state: FoldState,
  decision: {
    readonly choiceMode: boolean;
    readonly atChoicePoint: boolean;
    readonly baseTarget: number;
    readonly gameSet: "one" | "two" | undefined;
  },
): number | undefined {
  const { choiceMode, atChoicePoint, baseTarget, gameSet } = decision;
  if (!(choiceMode && state.gameTarget === undefined && atChoicePoint)) {
    return state.gameTarget;
  }
  return gameSet === "two" ? baseTarget + 1 : baseTarget;
}

export function applyPickleballPoint(
  state: FoldState,
  config: MatchConfig,
  winner: TeamId,
): FoldState {
  if (config.sport !== "pickleball") {
    throw new Error("applyPickleballPoint called for non-pickleball match");
  }

  const isDoubles = config.pbType === "doubles";
  const server = state.gameServer;
  const isSideout = winner !== server;

  if (!isSideout) {
    const points = bump(state.points, winner);
    const loser = otherTeam(winner);

    if (pbGameWon(config.pbTiebreak, config.pbTarget, points[winner], points[loser])) {
      const summary: SetSummary = { games: points, winner, kind: "set" };
      const afterGame: FoldState = {
        ...state,
        points: ZERO,
        gameServer: winner,
        pbServerNumber: isDoubles ? 2 : undefined,
        isFirstTerm: true,
        totalGames: bump(state.totalGames, winner),
      };
      return completeSet(afterGame, config, summary);
    }
    return { ...state, points };
  }

  if (isDoubles && state.pbServerNumber === 1) {
    return { ...state, pbServerNumber: 2 };
  }

  return {
    ...state,
    gameServer: otherTeam(server),
    isFirstTerm: false,
    pbServerNumber: isDoubles ? 1 : undefined,
  };
}

/**
 * A `serve` event: a team takes the undecided first serve of a pickleball
 * game 2+. No rally is scored; stray events (wrong sport, no pending serve)
 * are ignored so a stale replay can never corrupt the fold.
 */
export function applyServeEvent(state: FoldState, config: MatchConfig, winner: TeamId): FoldState {
  if (config.sport !== "pickleball" || state.pbServePending !== true) {
    return state;
  }
  return { ...state, gameServer: winner, pbServePending: false };
}
