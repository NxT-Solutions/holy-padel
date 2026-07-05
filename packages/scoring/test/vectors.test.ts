// biome-ignore lint/correctness/noNodejsModules: test reads the committed golden.json fixture
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { goldenVectors } from "../src/vectors.ts";

describe("golden vectors", () => {
  it("committed golden.json matches the engine (regen: node scripts/write-vectors.ts)", () => {
    // The committed vectors are the contract the Swift/Kotlin ports test against.
    // If the engine's output legitimately changes, regenerate and re-verify the ports.
    const committed: unknown = JSON.parse(
      readFileSync(new URL("../vectors/golden.json", import.meta.url), "utf8"),
    );
    expect(goldenVectors()).toEqual(committed);
  });
});
