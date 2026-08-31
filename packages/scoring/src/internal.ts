import { setsToWin, thirdSetWithoutTieBreak } from "./rules.ts";
import type { MatchConfig, SetSummary, TeamId, TeamValues, TieBreakKind } from "./types.ts";

/** Mutable fold state threaded through the point-event replay. */
export interface FoldState {
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
  /** Pickleball games 2+: the first serve of the current game is undecided. */
  pbServePending?: boolean | undefined;
  /** Squash "choice" tie-break: the current game's effective target once the receiver has decided. */
  gameTarget?: number | undefined;
  setNumber: number;
  finished: boolean;
  winner: TeamId | undefined;
  totalPoints: TeamValues<number>;
  totalGames: TeamValues<number>;
}

export const ZERO: TeamValues<number> = { A: 0, B: 0 };

export function bump(values: TeamValues<number>, team: TeamId): TeamValues<number> {
  return team === "A" ? { A: values.A + 1, B: values.B } : { A: values.A, B: values.B + 1 };
}

export function setsWonBy(sets: readonly SetSummary[], team: TeamId): number {
  return sets.filter((set) => set.winner === team).length;
}

/** The deciding set of a best-of-3 match, where third-set variants apply. */
const DECIDING_SET = 3;

export function isDecidingSet(config: MatchConfig, setNumber: number): boolean {
  return config.sport !== "squash" && config.bestOf === DECIDING_SET && setNumber === DECIDING_SET;
}

/** Is the set being played one that runs without a tie-break at 6-6? */
export function currentSetHasTieBreak(config: MatchConfig, setNumber: number): boolean {
  if (config.sport === "squash" || config.sport === "pickleball") {
    return false;
  }
  return !(isDecidingSet(config, setNumber) && thirdSetWithoutTieBreak(config.thirdSet));
}

/** Close out a set; start the next one unless the match is decided. */
export function completeSet(state: FoldState, config: MatchConfig, summary: SetSummary): FoldState {
  const completedSets = [...state.completedSets, summary];
  const finished = setsWonBy(completedSets, summary.winner) === setsToWin(config.bestOf);
  const settled: FoldState = { ...state, completedSets };
  if (finished) {
    return { ...settled, finished: true, winner: summary.winner, points: ZERO };
  }
  return startNextSet(settled, config);
}

function startNextSet(state: FoldState, config: MatchConfig): FoldState {
  const setNumber = state.setNumber + 1;
  // The padel variant's `sport` is optional (`undefined` means padel), so the
  // squash/pickleball check must not be an equality test against "padel".
  const padelConfig =
    config.sport === "squash" || config.sport === "pickleball" ? undefined : config;
  const superTieBreakDue =
    padelConfig !== undefined &&
    isDecidingSet(config, setNumber) &&
    padelConfig.thirdSet === "superTieBreak" &&
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
    // Pickleball: the first serve of each new game is undecided (the previous
    // game's winner does not automatically serve first).
    pbServePending: config.sport === "pickleball" ? true : undefined,
    gameTarget: undefined,
  };
}
