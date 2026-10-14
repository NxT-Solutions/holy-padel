import type { FoldState } from "./internal.ts";
import { bump, completeSet, currentSetHasTieBreak, ZERO } from "./internal.ts";
import {
  otherTeam,
  SUPER_TIE_BREAK_TARGET,
  setWon,
  standardGameWon,
  TIE_BREAK_TARGET,
  tieBreakDue,
  tieBreakWon,
} from "./rules.ts";
import { currentGameOf, deriveMoment, servingSideOf, servingTeamOf } from "./snapshot.ts";
import { applyPickleballPoint, applyServeEvent, applySquashPoint } from "./sports.ts";
import type { MatchConfig, MatchSnapshot, PointEvent, SetSummary, TeamId } from "./types.ts";

function initialState(config: MatchConfig): FoldState {
  return {
    completedSets: [],
    setGames: ZERO,
    points: ZERO,
    tieBreak: undefined,
    tieBreakStarter: config.firstServe,
    gameServer: config.firstServe,
    serverConsecutivePoints: 0,
    pbServerNumber: config.sport === "pickleball" && config.pbType === "doubles" ? 2 : undefined,
    isFirstTerm: config.sport === "pickleball",
    setNumber: 1,
    finished: false,
    winner: undefined,
    totalPoints: ZERO,
    totalGames: ZERO,
  };
}

function applyTieBreakPoint(state: FoldState, config: MatchConfig, winner: TeamId): FoldState {
  const kind = state.tieBreak;
  if (kind === undefined) {
    throw new Error("not in a tie-break");
  }
  const target = kind === "superTieBreak" ? SUPER_TIE_BREAK_TARGET : TIE_BREAK_TARGET;
  const points = bump(state.points, winner);
  const loser = otherTeam(winner);
  if (!tieBreakWon(target, points[winner], points[loser])) {
    return { ...state, points };
  }
  const totalGames = bump(state.totalGames, winner);
  if (kind === "superTieBreak") {
    const summary: SetSummary = { games: points, winner, kind: "superTieBreak" };
    return completeSet({ ...state, totalGames }, config, summary);
  }
  const setGames = bump(state.setGames, winner);
  const summary: SetSummary = { games: setGames, tieBreak: points, winner, kind: "set" };
  // FIP Rule 1, Tie-break pt 5: the pair who did not begin serving in the
  // tie-break serves first in the following set.
  const afterTieBreak: FoldState = {
    ...state,
    totalGames,
    setGames,
    tieBreak: undefined,
    gameServer: otherTeam(state.tieBreakStarter),
  };
  return completeSet(afterTieBreak, config, summary);
}

function applyStandardPoint(state: FoldState, config: MatchConfig, winner: TeamId): FoldState {
  if (config.sport === "squash" || config.sport === "pickleball") {
    throw new Error("applyStandardPoint called for non-padel match");
  }
  const points = bump(state.points, winner);
  const loser = otherTeam(winner);
  if (!standardGameWon(config.deuceMode, points[winner], points[loser])) {
    return { ...state, points };
  }
  const setGames = bump(state.setGames, winner);
  const totalGames = bump(state.totalGames, winner);
  const afterGame: FoldState = {
    ...state,
    points: ZERO,
    setGames,
    totalGames,
    gameServer: otherTeam(state.gameServer),
  };
  const withTieBreak = currentSetHasTieBreak(config, state.setNumber);
  if (setWon(setGames[winner], setGames[loser], withTieBreak)) {
    const summary: SetSummary = { games: setGames, winner, kind: "set" };
    return completeSet(afterGame, config, summary);
  }
  if (tieBreakDue(setGames.A, setGames.B, withTieBreak)) {
    return { ...afterGame, tieBreak: "setTieBreak", tieBreakStarter: afterGame.gameServer };
  }
  return afterGame;
}

function applyPoint(
  state: FoldState,
  config: MatchConfig,
  winner: TeamId,
  gameSet: "one" | "two" | undefined,
): FoldState {
  if (state.finished) {
    throw new Error("cannot score a point: the match is already finished");
  }
  const counted: FoldState = { ...state, totalPoints: bump(state.totalPoints, winner) };
  if (config.sport === "squash") {
    return applySquashPoint(counted, config, { winner, gameSet });
  }
  if (config.sport === "pickleball") {
    return applyPickleballPoint(counted, config, winner);
  }
  if (counted.tieBreak !== undefined) {
    return applyTieBreakPoint(counted, config, winner);
  }
  return applyStandardPoint(counted, config, winner);
}

function toSnapshot(state: FoldState, config: MatchConfig): MatchSnapshot {
  return {
    config,
    finished: state.finished,
    winner: state.winner,
    completedSets: state.completedSets,
    setNumber: state.finished ? state.completedSets.length : state.setNumber,
    currentSetGames: state.finished ? ZERO : state.setGames,
    currentGame: currentGameOf(state, config),
    servingTeam: servingTeamOf(state, config),
    servingSide: servingSideOf(state, config),

    moment: deriveMoment(state, config),
    totalPoints: state.totalPoints,
    totalGames: state.totalGames,
  };
}

/**
 * Fold a match from its config and the full list of point events.
 *
 * Events after the match is decided are ignored rather than fatal: a padel match
 * is settled by the events up to match point, and a late/duplicate tap (e.g. a
 * fast double-press racing the "finished" flip on a watch) must never crash the
 * fold. `applyPoint` still guards defensively, but we never call it once done.
 */
export function computeMatch(config: MatchConfig, events: readonly PointEvent[]): MatchSnapshot {
  let state = initialState(config);
  for (const event of events) {
    if (state.finished) {
      break;
    }
    state =
      event.kind === "serve"
        ? applyServeEvent(state, config, event.winner)
        : applyPoint(state, config, event.winner, event.gameSet);
  }
  return toSnapshot(state, config);
}

/** Undo is just forgetting the last event — the fold does the rest. */
export function undoLastPoint(events: readonly PointEvent[]): readonly PointEvent[] {
  return events.slice(0, -1);
}
