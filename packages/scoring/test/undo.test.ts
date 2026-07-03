import { describe, expect, it } from "vitest";
import { computeMatch, undoLastPoint } from "../src/index.ts";
import { ADVANTAGE_MATCH, loveSet, points, snap } from "./helpers.ts";

describe("undo (event sourcing)", () => {
  it("restores the exact previous score, across game boundaries", () => {
    const beforeGame = points("AAAB");
    const afterGame = points("AAABA");
    const undone = undoLastPoint(afterGame);
    expect(computeMatch(ADVANTAGE_MATCH, undone)).toEqual(
      computeMatch(ADVANTAGE_MATCH, beforeGame),
    );
  });

  it("can reopen a finished match", () => {
    const done = points(loveSet("A").repeat(2));
    expect(computeMatch(ADVANTAGE_MATCH, done).finished).toBe(true);
    const reopened = computeMatch(ADVANTAGE_MATCH, undoLastPoint(done));
    expect(reopened.finished).toBe(false);
    expect(reopened.moment).toEqual({ kind: "matchPoint", team: "A" });
  });

  it("is a no-op on an empty match", () => {
    expect(undoLastPoint([])).toEqual([]);
    expect(snap(ADVANTAGE_MATCH, "").totalPoints).toEqual({ A: 0, B: 0 });
  });
});
