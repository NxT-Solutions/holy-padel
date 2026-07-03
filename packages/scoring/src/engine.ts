import {
  DEUCE_POINTS,
  isDecidingPoint,
  otherTeam,
  SUPER_TIE_BREAK_TARGET,
  setsToWin,
  setWon,
  standardGameWon,
  TIE_BREAK_TARGET,
  thirdSetWithoutTieBreak,
  tieBreakDue,
  tieBreakServer,
  tieBreakWon,
} from "./rules.ts";
import type {
  CurrentGame,
  MatchConfig,
  MatchSnapshot,
  Moment,
  PointCall,
  PointEvent,
  SetSummary,
  TeamId,
  TeamValues,
  TieBreakKind,
} from "./types.ts";

interface FoldState {
  completedSets: SetSummary[];
  setGames: TeamValues<number>;
  points: TeamValues<number>;
  tieBreak: TieBreakKind | undefined;
  tieBreakStarter: TeamId;
  /** Server of the current standard game; after a game, the next game's server. */
  gameServer: TeamId;
  setNumber: number;
  finished: boolean;
  winner: TeamId | undefined;
  totalPoints: TeamValues<number>;
  totalGames: TeamValues<number>;
}

const ZERO: TeamValues<number> = { A: 0, B: 0 };

function bump(values: TeamValues<number>, team: TeamId): TeamValues<number> {
  return team === "A" ? { A: values.A + 1, B: values.B } : { A: values.A, B: values.B + 1 };
}

function setsWonBy(sets: readonly SetSummary[], team: TeamId): number {
  return sets.filter((set) => set.winner === team).length;
}

function initialState(config: MatchConfig): FoldState {
  return {
    completedSets: [],
    setGames: ZERO,
    points: ZERO,
    tieBreak: undefined,
    tieBreakStarter: config.firstServe,
    gameServer: config.firstServe,
    setNumber: 1,
    finished: false,
    winner: undefined,
    totalPoints: ZERO,
    totalGames: ZERO,
  };
}

/** The deciding set of a best-of-3 match, where third-set variants apply. */
const DECIDING_SET = 3;

function isDecidingSet(config: MatchConfig, setNumber: number): boolean {
  return config.bestOf === DECIDING_SET && setNumber === DECIDING_SET;
}

/** Is the set being played one that runs without a tie-break at 6-6? */
function currentSetHasTieBreak(config: MatchConfig, setNumber: number): boolean {
  return !(isDecidingSet(config, setNumber) && thirdSetWithoutTieBreak(config.thirdSet));
}

function startNextSet(state: FoldState, config: MatchConfig): FoldState {
  const setNumber = state.setNumber + 1;
  const superTieBreakDue =
    isDecidingSet(config, setNumber) &&
    config.thirdSet === "superTieBreak" &&
    setsWonBy(state.completedSets, "A") === setsWonBy(state.completedSets, "B");
  return {
    ...state,
    setNumber,
    setGames: ZERO,
    points: ZERO,
    tieBreak: superTieBreakDue ? "superTieBreak" : undefined,
    tieBreakStarter: state.gameServer,
  };
}

function completeSet(state: FoldState, config: MatchConfig, summary: SetSummary): FoldState {
  const completedSets = [...state.completedSets, summary];
  const finished = setsWonBy(completedSets, summary.winner) === setsToWin(config.bestOf);
  const settled: FoldState = { ...state, completedSets };
  if (finished) {
    return { ...settled, finished: true, winner: summary.winner, points: ZERO };
  }
  return startNextSet(settled, config);
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

function applyPoint(state: FoldState, config: MatchConfig, winner: TeamId): FoldState {
  if (state.finished) {
    throw new Error("cannot score a point: the match is already finished");
  }
  const counted: FoldState = { ...state, totalPoints: bump(state.totalPoints, winner) };
  if (counted.tieBreak !== undefined) {
    return applyTieBreakPoint(counted, config, winner);
  }
  return applyStandardPoint(counted, config, winner);
}

function pointCalls(points: TeamValues<number>): TeamValues<PointCall> {
  const call = (own: number, other: number): PointCall => {
    if (own <= DEUCE_POINTS) {
      const calls: readonly PointCall[] = ["0", "15", "30", "40"];
      const indexed = calls[own];
      if (indexed === undefined) {
        throw new Error(`impossible point count ${String(own)}`);
      }
      return indexed;
    }
    return own > other ? "AD" : "40";
  };
  return { A: call(points.A, points.B), B: call(points.B, points.A) };
}

function leaderOf(points: TeamValues<number>): TeamId | undefined {
  if (points.A === points.B) {
    return;
  }
  return points.A > points.B ? "A" : "B";
}

function standardGameMoment(state: FoldState, config: MatchConfig): Moment {
  const { points, setGames, setNumber, completedSets } = state;
  if (isDecidingPoint(config.deuceMode, points.A, points.B)) {
    return config.deuceMode === "goldenPoint" ? { kind: "goldenPoint" } : { kind: "starPoint" };
  }
  if (points.A >= DEUCE_POINTS && points.B >= DEUCE_POINTS) {
    const leader = leaderOf(points);
    if (leader === undefined) {
      return { kind: "deuce" };
    }
    return { kind: "advantage", team: leader };
  }
  const leader = leaderOf(points);
  if (leader === undefined) {
    return { kind: "normal" };
  }
  const loser = otherTeam(leader);
  if (!standardGameWon(config.deuceMode, points[leader] + 1, points[loser])) {
    return { kind: "normal" };
  }
  const withTieBreak = currentSetHasTieBreak(config, setNumber);
  if (!setWon(setGames[leader] + 1, setGames[loser], withTieBreak)) {
    return { kind: "gamePoint", team: leader };
  }
  const setsAfter = setsWonBy(completedSets, leader) + 1;
  if (setsAfter === setsToWin(config.bestOf)) {
    return { kind: "matchPoint", team: leader };
  }
  return { kind: "setPoint", team: leader };
}

function deriveMoment(state: FoldState, config: MatchConfig): Moment {
  if (state.finished) {
    if (state.winner === undefined) {
      throw new Error("finished match without a winner");
    }
    return { kind: "finished", winner: state.winner };
  }
  if (state.tieBreak === "superTieBreak") {
    return { kind: "superTieBreak" };
  }
  if (state.tieBreak === "setTieBreak") {
    return { kind: "tieBreak", setNumber: state.setNumber };
  }
  return standardGameMoment(state, config);
}

function currentGameOf(state: FoldState): CurrentGame | undefined {
  if (state.finished) {
    return;
  }
  if (state.tieBreak !== undefined) {
    return {
      kind: "tieBreak",
      tieBreakKind: state.tieBreak,
      target: state.tieBreak === "superTieBreak" ? SUPER_TIE_BREAK_TARGET : TIE_BREAK_TARGET,
      points: state.points,
    };
  }
  return {
    kind: "standard",
    points: state.points,
    calls: pointCalls(state.points),
  };
}

function servingTeamOf(state: FoldState): TeamId {
  if (state.tieBreak !== undefined) {
    return tieBreakServer(state.tieBreakStarter, state.points.A + state.points.B);
  }
  return state.gameServer;
}

function toSnapshot(state: FoldState, config: MatchConfig): MatchSnapshot {
  return {
    config,
    finished: state.finished,
    winner: state.winner,
    completedSets: state.completedSets,
    setNumber: state.finished ? state.completedSets.length : state.setNumber,
    currentSetGames: state.finished ? ZERO : state.setGames,
    currentGame: currentGameOf(state),
    servingTeam: servingTeamOf(state),
    moment: deriveMoment(state, config),
    totalPoints: state.totalPoints,
    totalGames: state.totalGames,
  };
}

/**
 * Fold a match from its config and the full list of point events.
 * Throws if the events continue past the end of the match.
 */
export function computeMatch(config: MatchConfig, events: readonly PointEvent[]): MatchSnapshot {
  let state = initialState(config);
  for (const event of events) {
    state = applyPoint(state, config, event.winner);
  }
  return toSnapshot(state, config);
}

/** Undo is just forgetting the last event — the fold does the rest. */
export function undoLastPoint(events: readonly PointEvent[]): readonly PointEvent[] {
  return events.slice(0, -1);
}
