import { readFileSync, writeFileSync } from 'fs';

let contentTypes = readFileSync('packages/scoring/src/types.ts', 'utf8');
contentTypes = contentTypes.replace(
  /export type CurrentGame =\n  \| \{\n      readonly kind: "standard" \| "tieBreak" \| "squash";/g,
  `export type CurrentGame =
  | {
      readonly kind: "standard" | "tieBreak" | "squash" | "pickleball";`
);
writeFileSync('packages/scoring/src/types.ts', contentTypes);

let contentMatches = readFileSync('packages/db/src/matches.ts', 'utf8');
contentMatches = contentMatches.replace(
  /export interface TeamPlayers \{\n  readonly A: readonly \[string, string\];\n  readonly B: readonly \[string, string\];\n\}/g,
  `export interface TeamPlayers {
  readonly A: readonly [string, string | undefined];
  readonly B: readonly [string, string | undefined];
}`
);
contentMatches = contentMatches.replace(
  /export interface TeamNames \{\n  readonly A: readonly \[string, string\];\n  readonly B: readonly \[string, string\];\n\}/g,
  `export interface TeamNames {
  readonly A: readonly [string, string | undefined];
  readonly B: readonly [string, string | undefined];
}`
);
writeFileSync('packages/db/src/matches.ts', contentMatches);

let contentVectors = readFileSync('packages/scoring/src/vectors.ts', 'utf8');
contentVectors = contentVectors.replace(
  /if \(game\.kind === "pickleball"\) \{/g,
  `if (game.kind === "pickleball") {`
);
writeFileSync('packages/scoring/src/vectors.ts', contentVectors);

