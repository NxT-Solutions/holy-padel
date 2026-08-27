import { readFileSync, writeFileSync } from 'fs';

// Fix types.ts
let contentTypes = readFileSync('packages/scoring/src/types.ts', 'utf8');

// Fix Squash dummy fields
contentTypes = contentTypes.replace(
  /readonly sport: "squash";\n      readonly bestOf: 1 \| 3 \| 5;\n      readonly squashMode: "par" \| "hiho";/g,
  `readonly sport: "squash";
      readonly bestOf: 1 | 3 | 5;
      readonly deuceMode: "advantage";
      readonly thirdSet: "fullSet";
      readonly squashMode: "par" | "hiho";`
);

// Fix CurrentGame
contentTypes = contentTypes.replace(
  /export type CurrentGame =\n  \| \{\n      readonly kind: "standard" \| "tieBreak" \| "squash";/g,
  `export type CurrentGame =
  | {
      readonly kind: "standard" | "tieBreak" | "squash" | "pickleball";`
);
writeFileSync('packages/scoring/src/types.ts', contentTypes);

// Fix matches.ts
let contentMatches = readFileSync('packages/db/src/matches.ts', 'utf8');
contentMatches = contentMatches.replace(
  /const SINGLE_SET = 1;\nconst BEST_OF_THREE = 3;\nconst BEST_OF_FIVE = 5;/g,
  ``
);
contentMatches = contentMatches.replace(
  /export interface TeamNames \{\n  readonly A: readonly \[string, string\];\n  readonly B: readonly \[string, string\];\n\}/g,
  `export interface TeamNames {
  readonly A: readonly [string, string | undefined];
  readonly B: readonly [string, string | undefined];
}`
);
// Make sure TeamNames is updated if it was missed due to formatting
contentMatches = contentMatches.replace(
  /export interface TeamNames \{\s*readonly A: readonly \[string, string\];\s*readonly B: readonly \[string, string\];\s*\}/g,
  `export interface TeamNames {
  readonly A: readonly [string, string | undefined];
  readonly B: readonly [string, string | undefined];
}`
);
writeFileSync('packages/db/src/matches.ts', contentMatches);

