import {
  DEUCE_POINTS,
  isDecidingPoint,
  otherTeam,
  pbGameWon,
  SUPER_TIE_BREAK_TARGET,
  setsToWin,
  setWon,
  squashGameWon,
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
  /** Consecutive points won by the current gameServer in their current serving term (for squash). */
  serverConsecutivePoints: number;
  /** Server number 1 or 2 for doubles (pickleball). */
  pbServerNumber?: 1 | 2 | undefined;
  /** Whether the current serving term is the first of the game (pickleball). */
  isFirstTerm?: boolean | undefined;
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

/** The deciding set of a best-of-3 match, where third-set variants apply. */
const DECIDING_SET = 3;

function isDecidingSet(config: MatchConfig, setNumber: number): boolean {
  return config.sport !== "squash" && config.bestOf === DECIDING_SET && setNumber === DECIDING_SET;
}

/** Is the set being played one that runs without a tie-break at 6-6? */
function currentSetHasTieBreak(config: MatchConfig, setNumber: number): boolean {
  if (config.sport === "squash" || config.sport === "pickleball") return false;
  return !(isDecidingSet(config, setNumber) && thirdSetWithoutTieBreak(config.thirdSet));
}

function startNextSet(state: FoldState, config: MatchConfig): FoldState {
  const setNumber = state.setNumber + 1;
  const superTieBreakDue =
    config.sport !== "squash" &&
    config.sport !== "pickleball" &&
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
    pbServerNumber: config.sport === "pickleball" && config.pbType === "doubles" ? 2 : undefined,
    isFirstTerm: config.sport === "pickleball",
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

function applySquashPoint(state: FoldState, config: MatchConfig, winner: TeamId): FoldState {
  if (config.sport !== "squash") {
    throw new Error("applySquashPoint called for padel match");
  }
  const isPar = config.squashMode === "par";
  const points = isPar || winner === state.gameServer ? bump(state.points, winner) : state.points;
  const loser = otherTeam(winner);

  const serverConsecutivePoints =
    winner === state.gameServer ? state.serverConsecutivePoints + 1 : 0;

  if (!squashGameWon(config.squashTiebreak, config.squashTarget, points[winner], points[loser])) {
    return { ...state, points, gameServer: winner, serverConsecutivePoints };
  }

  const summary: SetSummary = { games: points, winner, kind: "set" };
  const afterGame: FoldState = {
    ...state,
    points: ZERO,
    gameServer: winner,
    serverConsecutivePoints: 0,
    totalGames: bump(state.totalGames, winner),
  };
  return completeSet(afterGame, config, summary);
}

function applyPickleballPoint(state: FoldState, config: MatchConfig, winner: TeamId): FoldState {
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

function applyPoint(state: FoldState, config: MatchConfig, winner: TeamId): FoldState {
  if (state.finished) {
    throw new Error("cannot score a point: the match is already finished");
  }
  const counted: FoldState = { ...state, totalPoints: bump(state.totalPoints, winner) };
  if (config.sport === "squash") {
    return applySquashPoint(counted, config, winner);
  }
  if (config.sport === "pickleball") {
    return applyPickleballPoint(counted, config, winner);
  }
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
  if (config.sport === "squash" || config.sport === "pickleball") {
    throw new Error("standardGameMoment called for non-padel match");
  }
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

function squashMoment(state: FoldState, config: MatchConfig): Moment {
  if (config.sport !== "squash") throw new Error("not squash");
  const { points, completedSets } = state;
  const leader = leaderOf(points);
  if (leader === undefined) return { kind: "normal" };

  const loser = otherTeam(leader);
  const potentialPoints = bump(points, leader);
  if (
    !squashGameWon(
      config.squashTiebreak,
      config.squashTarget,
      potentialPoints[leader],
      potentialPoints[loser],
    )
  ) {
    return { kind: "normal" };
  }

  const gamesAfter = setsWonBy(completedSets, leader) + 1;
  if (gamesAfter === setsToWin(config.bestOf)) {
    return { kind: "matchPoint", team: leader };
  }
  // In squash we just use gamePoint for game-point, as there are no sets above games.
  return { kind: "gamePoint", team: leader };
}

function pickleballMoment(state: FoldState, config: MatchConfig): Moment {
  if (config.sport !== "pickleball") throw new Error("not pickleball");
  const { points, completedSets } = state;
  const leader = leaderOf(points);
  if (leader === undefined) return { kind: "normal" };

  const loser = otherTeam(leader);
  const potentialPoints = bump(points, leader);
  if (
    !pbGameWon(config.pbTiebreak, config.pbTarget, potentialPoints[leader], potentialPoints[loser])
  ) {
    return { kind: "normal" };
  }

  const gamesAfter = setsWonBy(completedSets, leader) + 1;
  if (gamesAfter === setsToWin(config.bestOf)) {
    return { kind: "matchPoint", team: leader };
  }
  return { kind: "gamePoint", team: leader };
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
  if (config.sport === "squash") {
    return squashMoment(state, config);
  }
  if (config.sport === "pickleball") {
    return pickleballMoment(state, config);
  }
  return standardGameMoment(state, config);
}

function currentGameOf(state: FoldState, config: MatchConfig): CurrentGame | undefined {
  if (state.finished) {
    return;
  }
  if (config.sport === "squash") {
    return {
      kind: "squash",
      points: state.points,
    };
  }
  if (config.sport === "pickleball") {
    return {
      kind: "pickleball",
      points: { A: state.points.A, B: state.points.B },
      ...(state.pbServerNumber !== undefined ? { serverNumber: state.pbServerNumber } : {}),
    };
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

function servingTeamOf(state: FoldState, config: MatchConfig): TeamId | undefined {
  if (config.firstServePending && state.totalPoints.A === 0 && state.totalPoints.B === 0) {
    return;
  }
  if (state.tieBreak !== undefined) {
    return tieBreakServer(state.tieBreakStarter, state.points.A + state.points.B);
  }
  return state.gameServer;
}

function pbServingSideOf(state: FoldState, config: MatchConfig): "right" | "left" {
  if (config.sport !== "pickleball") throw new Error("not pickleball");
  const score = state.points[state.gameServer];
  if (state.pbServerNumber === 1 || state.isFirstTerm) {
    return score % 2 === 0 ? "right" : "left";
  }
  return score % 2 === 0 ? "left" : "right";
}

function servingSideOf(state: FoldState, config: MatchConfig): "right" | "left" | undefined {
  if (config.firstServePending && state.totalPoints.A === 0 && state.totalPoints.B === 0) {
    return;
  }
  if (config.sport === "pickleball") {
    return pbServingSideOf(state, config);
  }
  if (config.sport === "squash") {
    return state.serverConsecutivePoints % 2 === 0 ? "right" : "left";
  }
  return (state.points.A + state.points.B) % 2 === 0 ? "right" : "left";
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
    state = applyPoint(state, config, event.winner);
  }
  return toSnapshot(state, config);
}

/** Undo is just forgetting the last event — the fold does the rest. */
export function undoLastPoint(events: readonly PointEvent[]): readonly PointEvent[] {
  return events.slice(0, -1);
}
