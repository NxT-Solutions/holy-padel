/** One of the two pairs on court. */
export type TeamId = "A" | "B";

/**
 * How a game is decided from deuce — the three official options of
 * FIP Rule 1 ("Score in a game"). See docs/fip-scoring-spec.md §1.
 */
export type DeuceMode = "advantage" | "starPoint" | "goldenPoint";

/**
 * What is played when a best-of-3 match reaches one set all.
 * - `fullSet`: a normal third set, tie-break at 6-6.
 * - `advantageSet`: a third set without tie-break — two clear games win (FIP Rule 1, Score pt 4).
 * - `superTieBreak`: a tie-break to 10 points replaces the third set (FIP Alternative Score Methods 1c).
 */
export type ThirdSetMode = "fullSet" | "advantageSet" | "superTieBreak";

export interface MatchConfig {
  readonly bestOf: 1 | 3;
  readonly deuceMode: DeuceMode;
  readonly thirdSet: ThirdSetMode;
  /** Team serving the first game of the match. */
  readonly firstServe: TeamId;
}

/** The only mutating event of a match: a rally ended and `winner` won it. */
export interface PointEvent {
  readonly winner: TeamId;
  /** Epoch milliseconds — used for durations, never for scoring. */
  readonly at: number;
}

export interface TeamValues<T> {
  readonly A: T;
  readonly B: T;
}

/** Display call for a standard game: 0, 15, 30, 40 or advantage. */
export type PointCall = "0" | "15" | "30" | "40" | "AD";

export type TieBreakKind = "setTieBreak" | "superTieBreak";

/** A finished set (a super tie-break counts as the deciding set). */
export interface SetSummary {
  readonly games: TeamValues<number>;
  /** Present when the set was decided by a tie-break at 6-6. */
  readonly tieBreak?: TeamValues<number>;
  readonly winner: TeamId;
  readonly kind: "set" | "superTieBreak";
}

/** What the current point means — drives the status pill in the live UI. */
export type Moment =
  | { readonly kind: "normal" }
  | { readonly kind: "gamePoint"; readonly team: TeamId }
  | { readonly kind: "setPoint"; readonly team: TeamId }
  | { readonly kind: "matchPoint"; readonly team: TeamId }
  | { readonly kind: "deuce" }
  | { readonly kind: "advantage"; readonly team: TeamId }
  | { readonly kind: "goldenPoint" }
  | { readonly kind: "starPoint" }
  | { readonly kind: "tieBreak"; readonly setNumber: number }
  | { readonly kind: "superTieBreak" }
  | { readonly kind: "finished"; readonly winner: TeamId };

/** The live game being played, in one of its two shapes. */
export type CurrentGame =
  | {
      readonly kind: "standard";
      readonly points: TeamValues<number>;
      readonly calls: TeamValues<PointCall>;
    }
  | {
      readonly kind: "tieBreak";
      readonly tieBreakKind: TieBreakKind;
      readonly target: number;
      readonly points: TeamValues<number>;
    };

/** Everything the UI needs about a match, derived from config + events. */
export interface MatchSnapshot {
  readonly config: MatchConfig;
  readonly finished: boolean;
  readonly winner: TeamId | undefined;
  readonly completedSets: readonly SetSummary[];
  /** 1-based number of the set in play (or the last one when finished). */
  readonly setNumber: number;
  /** Games in the set in play; zeros when the match is finished. */
  readonly currentSetGames: TeamValues<number>;
  /** The game in play; undefined once the match is finished. */
  readonly currentGame: CurrentGame | undefined;
  /** Team serving the point in play (tie-break rotation included). */
  readonly servingTeam: TeamId;
  readonly moment: Moment;
  /** Rally points won over the whole match. */
  readonly totalPoints: TeamValues<number>;
  /** Games won over the whole match (tie-breaks count as one game). */
  readonly totalGames: TeamValues<number>;
}
