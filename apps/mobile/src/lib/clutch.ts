import type { MatchConfig, MatchSnapshot, Moment, PointEvent, TeamId } from "@holy-padel/scoring";
import { replayMatch } from "@holy-padel/scoring";

/** Won out of played. */
export interface Tally {
  readonly won: number;
  readonly of: number;
}

/** How one side played the points that mattered, from that side's view. */
export interface Clutch {
  /** Every rally. */
  readonly points: Tally;
  /** Rallies where this side was one point from the game (or set, or match): won = closed out. */
  readonly closing: Tally;
  /** Rallies where the other side was one point from the game: won = saved. */
  readonly saving: Tally;
  /** Golden / star points — one rally decides the game. Padel only. */
  readonly deciding: Tally;
  /** Break points while receiving: won = converted. Padel only. */
  readonly breakPoints: Tally;
  /** Break points faced on your own serve: won = saved. Padel only. */
  readonly serveSaves: Tally;
  /** Tie-breaks and super tie-breaks. */
  readonly tieBreaks: Tally;
}

const NONE: Tally = { won: 0, of: 0 };

export const EMPTY_CLUTCH: Clutch = {
  points: NONE,
  closing: NONE,
  saving: NONE,
  deciding: NONE,
  breakPoints: NONE,
  serveSaves: NONE,
  tieBreaks: NONE,
};

function count(tally: Tally, won: boolean): Tally {
  return { won: tally.won + (won ? 1 : 0), of: tally.of + 1 };
}

function sum(left: Tally, right: Tally): Tally {
  return { won: left.won + right.won, of: left.of + right.of };
}

export function addClutch(left: Clutch, right: Clutch): Clutch {
  return {
    points: sum(left.points, right.points),
    closing: sum(left.closing, right.closing),
    saving: sum(left.saving, right.saving),
    deciding: sum(left.deciding, right.deciding),
    breakPoints: sum(left.breakPoints, right.breakPoints),
    serveSaves: sum(left.serveSaves, right.serveSaves),
    tieBreaks: sum(left.tieBreaks, right.tieBreaks),
  };
}

/** Whole percent, or undefined with nothing played. */
export function percentOf(tally: Tally): number | undefined {
  return tally.of === 0 ? undefined : Math.round((tally.won / tally.of) * 100);
}

/** The side one rally away from taking the game, or "both" on a golden / star point. */
function onGamePoint(moment: Moment): TeamId | "both" | undefined {
  switch (moment.kind) {
    case "gamePoint":
    case "setPoint":
    case "matchPoint":
    case "advantage":
      return moment.team;
    case "goldenPoint":
    case "starPoint":
    case "setChoice":
      return "both";
    default:
      return;
  }
}

function isPadel(config: MatchConfig): boolean {
  return config.sport === undefined || config.sport === "padel";
}

/** Tally one rally into the running clutch record. */
function tallyRally(clutch: Clutch, before: MatchSnapshot, winner: TeamId, team: TeamId): Clutch {
  const won = winner === team;
  const onPoint = onGamePoint(before.moment);
  let next: Clutch = { ...clutch, points: count(clutch.points, won) };
  if (onPoint === undefined) {
    return next;
  }
  // A golden / star point is both: one rally to win the game, one to save it.
  if (onPoint === "both" || onPoint === team) {
    next = { ...next, closing: count(next.closing, won) };
  }
  if (onPoint === "both" || onPoint !== team) {
    next = { ...next, saving: count(next.saving, won) };
  }
  if (!isPadel(before.config) || before.currentGame?.kind !== "standard") {
    return next;
  }
  if (onPoint === "both") {
    next = { ...next, deciding: count(next.deciding, won) };
  }
  const server = before.servingTeam;
  const receiverOnPoint = server !== undefined && (onPoint === "both" || onPoint !== server);
  if (!receiverOnPoint) {
    return next;
  }
  return server === team
    ? { ...next, serveSaves: count(next.serveSaves, won) }
    : { ...next, breakPoints: count(next.breakPoints, won) };
}

/** One match's clutch record for `team`. */
export function matchClutch(
  config: MatchConfig,
  events: readonly PointEvent[],
  team: TeamId,
): Clutch {
  const snapshots = replayMatch(config, events);
  let clutch = EMPTY_CLUTCH;
  events.forEach((event, index) => {
    const before = snapshots[index];
    if (event.kind !== "serve" && before !== undefined && !before.finished) {
      clutch = tallyRally(clutch, before, event.winner, team);
    }
  });
  const final = snapshots.at(-1);
  for (const set of final?.completedSets ?? []) {
    if (set.tieBreak !== undefined || set.kind === "superTieBreak") {
      clutch = { ...clutch, tieBreaks: count(clutch.tieBreaks, set.winner === team) };
    }
  }
  return clutch;
}

/** A set (a game, in squash and pickleball) turned around from a deficit. */
export interface Turnaround {
  readonly setNumber: number;
  /** True when `team` came back to win it; false when `team` let a lead slip. */
  readonly cameBack: boolean;
  /** The score at the widest gap, `team`'s side first. */
  readonly at: { readonly own: number; readonly other: number };
}

/** The scoreline a set is counted in: games in padel, rally points elsewhere. */
function unitScore(snapshot: MatchSnapshot): { readonly A: number; readonly B: number } {
  if (isPadel(snapshot.config)) {
    return snapshot.currentSetGames;
  }
  const game = snapshot.currentGame;
  return game === undefined ? { A: 0, B: 0 } : game.points;
}

/** The smallest gap that counts as a turnaround: two games, or four rally points. */
function turnaroundGap(config: MatchConfig): number {
  return isPadel(config) ? 2 : 4;
}

interface Widest {
  readonly own: number;
  readonly other: number;
}

function widen(current: Widest | undefined, own: number, other: number, sign: 1 | -1): Widest {
  if (current === undefined || (other - own) * sign > (current.other - current.own) * sign) {
    return { own, other };
  }
  return current;
}

/**
 * Sets won from at least two games down (four points in squash and
 * pickleball), and sets lost from that far up — each with the score at the
 * widest gap, from `team`'s side.
 */
export function matchTurnarounds(
  config: MatchConfig,
  events: readonly PointEvent[],
  team: TeamId,
): Turnaround[] {
  const snapshots = replayMatch(config, events);
  const other: TeamId = team === "A" ? "B" : "A";
  const gap = turnaroundGap(config);
  const worst = new Map<number, Widest>();
  const best = new Map<number, Widest>();
  for (const snapshot of snapshots) {
    if (!snapshot.finished) {
      const score = unitScore(snapshot);
      const set = snapshot.setNumber;
      worst.set(set, widen(worst.get(set), score[team], score[other], 1));
      best.set(set, widen(best.get(set), score[team], score[other], -1));
    }
  }
  const final = snapshots.at(-1);
  const turnarounds: Turnaround[] = [];
  final?.completedSets.forEach((set, index) => {
    const setNumber = index + 1;
    const behind = worst.get(setNumber);
    const ahead = best.get(setNumber);
    if (set.winner === team && behind !== undefined && behind.other - behind.own >= gap) {
      turnarounds.push({ setNumber, cameBack: true, at: behind });
    }
    if (set.winner !== team && ahead !== undefined && ahead.own - ahead.other >= gap) {
      turnarounds.push({ setNumber, cameBack: false, at: ahead });
    }
  });
  return turnarounds;
}
