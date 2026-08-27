import { readFileSync, writeFileSync } from 'fs';

const file = 'packages/scoring/src/types.ts';
let content = readFileSync(file, 'utf8');

// 1. Add Pickleball to MatchConfig
content = content.replace(
  /export type MatchConfig =\n  \| \{\n      readonly sport\?: "padel";([\s\S]*?)readonly firstServePending\?: boolean;\n    \}\n  \| \{\n      readonly sport: "squash";([\s\S]*?)readonly firstServePending\?: boolean;\n    \};/,
  `export type MatchConfig =
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
      readonly squashMode: "par" | "hiho";
      readonly squashTarget: number;
      readonly squashTiebreak: SquashTiebreak;
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
      readonly pbTiebreak: "winByTwo" | "winByOne";
    };`
);

// 2. Add pickleball to CurrentGame kind
content = content.replace(
  /export type CurrentGame =([\s\S]*?)kind: "standard" \| "tieBreak" \| "squash";/m,
  `export type CurrentGame =
  | {
      readonly kind: "standard" | "tieBreak" | "squash" | "pickleball";`
);

// 3. Add pbServerNumber and isFirstTerm to FoldState
content = content.replace(
  /export interface FoldState \{([\s\S]*?)readonly sets: readonly SetState\[\];\n\}/m,
  `export interface FoldState {
  readonly points: TeamValues<number>;
  readonly gameServer: TeamId;
  readonly completedSets: number;
  readonly sets: readonly SetState[];
  readonly pbServerNumber?: 1 | 2;
  readonly isFirstTerm?: boolean;
}`
);

writeFileSync(file, content);
