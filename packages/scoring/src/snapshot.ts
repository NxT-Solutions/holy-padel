import type { FoldState } from "./internal.ts";
import { bump, currentSetHasTieBreak, setsWonBy } from "./internal.ts";
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
  tieBreakServer,
} from "./rules.ts";
import type { CurrentGame, MatchConfig, Moment, PointCall, TeamId, TeamValues } from "./types.ts";

/** What the current point means, given the fold state — drives the status pill. */
export function deriveMoment(state: FoldState, config: MatchConfig): Moment {
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

export function currentGameOf(state: FoldState, config: MatchConfig): CurrentGame | undefined {
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
      ...(state.pbServerNumber === undefined ? {} : { serverNumber: state.pbServerNumber }),
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

export function leaderOf(points: TeamValues<number>): TeamId | undefined {
  if (points.A === points.B) {
    return;
  }
  return points.A > points.B ? "A" : "B";
}

export function standardGameMoment(state: FoldState, config: MatchConfig): Moment {
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

export function squashMoment(state: FoldState, config: MatchConfig): Moment {
  if (config.sport !== "squash") {
    throw new Error("not squash");
  }
  const { points, completedSets } = state;
  // "Choice" tie-break: at target-1 all the receiver picks long or short.
  if (
    config.squashTiebreak === "choice" &&
    state.gameTarget === undefined &&
    points.A === config.squashTarget - 1 &&
    points.B === config.squashTarget - 1
  ) {
    return { kind: "setChoice" };
  }
  const leader = leaderOf(points);
  if (leader === undefined) {
    return { kind: "normal" };
  }

  const loser = otherTeam(leader);
  const potentialPoints = bump(points, leader);
  // In "choice" mode the decided game runs first-to-effective-target.
  const effectiveTiebreak: "winByTwo" | "setOne" | "setTwo" =
    config.squashTiebreak === "choice" ? "setOne" : config.squashTiebreak;
  const target =
    config.squashTiebreak === "choice"
      ? (state.gameTarget ?? config.squashTarget)
      : config.squashTarget;
  if (!squashGameWon(effectiveTiebreak, target, potentialPoints[leader], potentialPoints[loser])) {
    return { kind: "normal" };
  }

  const gamesAfter = setsWonBy(completedSets, leader) + 1;
  if (gamesAfter === setsToWin(config.bestOf)) {
    return { kind: "matchPoint", team: leader };
  }
  // In squash we just use gamePoint for game-point, as there are no sets above games.
  return { kind: "gamePoint", team: leader };
}

export function pickleballMoment(state: FoldState, config: MatchConfig): Moment {
  if (config.sport !== "pickleball") {
    throw new Error("not pickleball");
  }
  const { points, completedSets } = state;
  const leader = leaderOf(points);
  if (leader === undefined) {
    return { kind: "normal" };
  }

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

export function pointCalls(points: TeamValues<number>): TeamValues<PointCall> {
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

export function servingTeamOf(state: FoldState, config: MatchConfig): TeamId | undefined {
  if (config.firstServePending && state.totalPoints.A === 0 && state.totalPoints.B === 0) {
    return;
  }
  // Pickleball games 2+: the first serve of the new game is undecided.
  if (state.pbServePending === true) {
    return;
  }
  if (state.tieBreak !== undefined) {
    return tieBreakServer(state.tieBreakStarter, state.points.A + state.points.B);
  }
  return state.gameServer;
}

export function servingSideOf(state: FoldState, config: MatchConfig): "right" | "left" | undefined {
  if (config.firstServePending && state.totalPoints.A === 0 && state.totalPoints.B === 0) {
    return;
  }
  if (state.pbServePending === true) {
    return;
  }
  if (config.sport === "pickleball") {
    return pbServingSideOf(state, config);
  }
  if (config.sport === "squash") {
    return squashServingSideOf(state, config);
  }
  return (state.points.A + state.points.B) % 2 === 0 ? "right" : "left";
}

function pbServingSideOf(state: FoldState, config: MatchConfig): "right" | "left" {
  if (config.sport !== "pickleball") {
    throw new Error("not pickleball");
  }
  const score = state.points[state.gameServer];
  // Singles: the server's own score parity picks the box (even → right).
  if (config.pbType === "singles") {
    return score % 2 === 0 ? "right" : "left";
  }
  if (state.pbServerNumber === 1 || state.isFirstTerm) {
    return score % 2 === 0 ? "right" : "left";
  }
  return score % 2 === 0 ? "left" : "right";
}

function squashServingSideOf(
  state: FoldState,
  config: Extract<MatchConfig, { readonly sport: "squash" }>,
): "right" | "left" {
  // Squash serving: the chosen mode picks each hand's FIRST box — a fixed
  // right/left, or the team's saved preference (default right) — then the
  // boxes alternate every point while the team holds serve.
  const boxes = config.squashServeBoxes ?? "right";
  const startBox = boxes === "player" ? preferredBox(state, config) : boxes;
  return state.serverConsecutivePoints % 2 === 0 ? startBox : otherBox(startBox);
}

function preferredBox(
  state: FoldState,
  config: Extract<MatchConfig, { readonly sport: "squash" }>,
): "right" | "left" {
  return state.gameServer === "A"
    ? (config.squashServeBoxA ?? "right")
    : (config.squashServeBoxB ?? "right");
}

function otherBox(box: "right" | "left"): "right" | "left" {
  return box === "right" ? "left" : "right";
}
