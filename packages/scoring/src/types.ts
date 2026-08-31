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

export type SquashTiebreak = "winByTwo" | "setOne" | "setTwo" | "choice";

/** How a pickleball game is decided at the target point. */
export type PbTiebreak = "winByTwo" | "winByOne";

/**
 * What picks each hand's FIRST service box: a fixed `right`/`left` box, or
 * `player` — the serving team's saved preference (default right). Either way
 * the boxes then alternate every point while the team holds serve.
 */
export type SquashServeBoxes = "right" | "left" | "player";

export type MatchConfig =
  | {
      readonly sport?: "padel";
      readonly bestOf: 1 | 3 | 5;
      readonly deuceMode: DeuceMode;
      readonly thirdSet: ThirdSetMode;
      /** Team serving the first game of the match. */
      readonly firstServe: TeamId;
      readonly firstServePending?: boolean;
      readonly firstServeOriginallyUndecided?: boolean;
    }
  | {
      readonly sport: "squash";
      readonly bestOf: 1 | 3 | 5;
      readonly deuceMode: "advantage";
      readonly thirdSet: "fullSet";
      readonly squashMode: "par" | "hiho";
      readonly squashTarget: number;
      readonly squashTiebreak: SquashTiebreak;
      /**
       * What picks the first service box of each hand (default `right`): a
       * fixed box, or the team's saved preference resolved at match creation
       * into squashServeBoxA/B. The hand then alternates boxes point-to-point.
       */
      readonly squashServeBoxes?: SquashServeBoxes;
      readonly squashServeBoxA?: "right" | "left";
      readonly squashServeBoxB?: "right" | "left";
      readonly firstServe: TeamId;
      readonly firstServePending?: boolean;
      readonly firstServeOriginallyUndecided?: boolean;
    }
  | {
      readonly sport: "pickleball";
      readonly bestOf: 1 | 3 | 5;
      readonly deuceMode: "advantage";
      readonly thirdSet: "superTieBreak";
      readonly firstServe: TeamId;
      readonly firstServePending?: boolean;
      readonly firstServeOriginallyUndecided?: boolean;
      readonly pbType: "singles" | "doubles";
      readonly pbTarget: number;
      readonly pbTiebreak: PbTiebreak;
    };

/**
 * One event of a match's log. Most events are rallies (`kind: "point"`, the
 * default when the field is omitted); a `serve` event records which team takes
 * the first serve of a pickleball game 2+ and scores no rally.
 */
export interface PointEvent {
  readonly winner: TeamId;
  /** Epoch milliseconds — used for durations, never for scoring. */
  readonly at: number;
  readonly kind?: "point" | "serve";
  /**
   * Squash "choice" tie-break: the receiver's decision at target-1 all —
   * "one" keeps the game at its target, "two" extends it by one point. It
   * rides on the rally played at the choice point, so undo and resume work
   * without extra state.
   */
  readonly gameSet?: "one" | "two";
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
  | {
      /** Squash "choice" tie-break: the game is at target-1 all and the receiver must pick long or short. */
      readonly kind: "setChoice";
    }
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
    }
  | {
      readonly kind: "squash";
      readonly points: TeamValues<number>;
    }
  | {
      readonly kind: "pickleball";
      readonly points: TeamValues<number>;
      readonly serverNumber?: 1 | 2;
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
  readonly servingTeam: TeamId | undefined;
  /** Side of the court the server is serving from. */
  readonly servingSide: "right" | "left" | undefined;
  readonly moment: Moment;
  /** Rally points won over the whole match. */
  readonly totalPoints: TeamValues<number>;
  /** Games won over the whole match (tie-breaks count as one game). */
  readonly totalGames: TeamValues<number>;
}
