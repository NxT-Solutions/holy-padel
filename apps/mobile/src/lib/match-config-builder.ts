import type {
  DeuceMode,
  MatchConfig,
  PbTiebreak,
  SquashServeBoxes,
  SquashTiebreak,
  TeamId,
  ThirdSetMode,
} from "@holy-padel/scoring";

export interface ConfigInput {
  readonly sport: "padel" | "squash" | "pickleball";
  readonly bestOf: 1 | 3 | 5;
  readonly thirdSet: ThirdSetMode;
  readonly deuceMode: DeuceMode;
  readonly squashMode: "par" | "hiho";
  readonly squashTarget: number;
  readonly squashTiebreak: SquashTiebreak;
  readonly squashServeBoxes: SquashServeBoxes;
  readonly pbType: "singles" | "doubles";
  readonly pbTarget: number;
  readonly pbTiebreak: PbTiebreak;
  readonly firstServe: TeamId;
  readonly firstServePending: boolean;
  /** Resolves a team lead player's saved serve-box preference. */
  readonly resolveServeBox: (playerId: string) => "right" | "left";
  readonly teamA1: string;
  readonly opponent1: string | undefined;
}

/** Build the sport-specific MatchConfig from the picker state. */
export function buildConfig(input: ConfigInput): MatchConfig {
  const serveBoxes =
    input.opponent1 === undefined
      ? {}
      : {
          squashServeBoxA: input.resolveServeBox(input.teamA1),
          squashServeBoxB: input.resolveServeBox(input.opponent1),
        };
  if (input.sport === "squash") {
    return {
      sport: "squash",
      bestOf: input.bestOf,
      deuceMode: "advantage",
      thirdSet: "fullSet",
      squashMode: input.squashMode,
      squashTarget: input.squashTarget,
      squashTiebreak: input.squashTiebreak,
      squashServeBoxes: input.squashServeBoxes,
      ...serveBoxes,
      firstServe: input.firstServe,
      firstServePending: input.firstServePending,
      firstServeOriginallyUndecided: input.firstServePending,
    };
  }
  if (input.sport === "pickleball") {
    return {
      sport: "pickleball",
      bestOf: input.bestOf,
      deuceMode: "advantage",
      thirdSet: "superTieBreak",
      pbType: input.pbType,
      pbTarget: input.pbTarget,
      pbTiebreak: input.pbTiebreak,
      firstServe: input.firstServe,
      firstServePending: input.firstServePending,
      firstServeOriginallyUndecided: input.firstServePending,
    };
  }
  return {
    sport: "padel",
    bestOf: input.bestOf,
    deuceMode: input.deuceMode,
    thirdSet: input.thirdSet,
    firstServe: input.firstServe,
    firstServePending: input.firstServePending,
    firstServeOriginallyUndecided: input.firstServePending,
  };
}
