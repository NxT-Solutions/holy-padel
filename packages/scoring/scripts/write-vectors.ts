import { writeFileSync } from "node:fs";
import { goldenVectors } from "../src/vectors.ts";

// Regenerate the committed golden vectors from the canonical TS engine:
//   node packages/scoring/scripts/write-vectors.ts
const target = new URL("../vectors/golden.json", import.meta.url);
writeFileSync(target, `${JSON.stringify(goldenVectors(), null, 0)}\n`);
process.stdout.write(`wrote ${goldenVectors().length} vectors to vectors/golden.json\n`);
