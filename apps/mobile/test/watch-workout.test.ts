import { describe, expect, it } from "vitest";
import { parseWorkoutSummary } from "../src/health/watch-workout.ts";

const valid = {
  startedAt: 1000,
  endedAt: 3_600_000,
  kcal: 412.5,
  avgBpm: 132,
  maxBpm: 171,
  samples: [
    { t: 20_000, bpm: 120 },
    { t: 35_000, bpm: 141 },
  ],
};

describe("parseWorkoutSummary", () => {
  it("parses a full summary", () => {
    expect(parseWorkoutSummary(JSON.stringify(valid))).toEqual(valid);
  });

  it("drops malformed samples but keeps the workout", () => {
    const messy = {
      ...valid,
      samples: [{ t: 20_000, bpm: 120 }, { bpm: 130 }, "junk", { t: 40_000, bpm: 0 }],
    };
    expect(parseWorkoutSummary(JSON.stringify(messy))?.samples).toEqual([{ t: 20_000, bpm: 120 }]);
  });

  it("accepts calories-only summaries (no HR sensor)", () => {
    const caloriesOnly = { ...valid, avgBpm: 0, maxBpm: 0, samples: [] };
    expect(parseWorkoutSummary(JSON.stringify(caloriesOnly))?.kcal).toBe(412.5);
  });

  it("rejects summaries with nothing measurable", () => {
    expect(parseWorkoutSummary(JSON.stringify({ ...valid, kcal: 0, samples: [] }))).toBeUndefined();
  });

  it("rejects garbage, inverted intervals and non-objects", () => {
    expect(parseWorkoutSummary("not json")).toBeUndefined();
    expect(parseWorkoutSummary('"a string"')).toBeUndefined();
    expect(parseWorkoutSummary(JSON.stringify({ ...valid, endedAt: 500 }))).toBeUndefined();
    expect(parseWorkoutSummary(JSON.stringify({ kcal: 300 }))).toBeUndefined();
  });
});
