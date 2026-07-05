import type { MatchConfig } from "@holy-padel/scoring";
import { describe, expect, it } from "vitest";
import { createMatch, loadEvents, pauseMatch, scorePoint } from "../src/index.ts";
import { newMatch, seededDriver } from "./fixtures.ts";

// Single set, love games — 24 points and A wins 6-0.
const SINGLE_SET: MatchConfig = {
  bestOf: 1,
  deuceMode: "advantage",
  thirdSet: "fullSet",
  firstServe: "A",
};

describe("scorePoint guard", () => {
  it("records a normal point", () => {
    const driver = seededDriver();
    createMatch(driver, newMatch("m1", { config: SINGLE_SET }));
    scorePoint(driver, "m1", "A", 1);
    expect(loadEvents(driver, "m1").map((e) => e.winner)).toEqual(["A"]);
  });

  it("refuses points once the match is decided — a burst of taps can't over-append", () => {
    const driver = seededDriver();
    createMatch(driver, newMatch("m1", { config: SINGLE_SET }));

    // 30 rapid taps, but the set is won at 24 points.
    for (let i = 0; i < 30; i += 1) {
      scorePoint(driver, "m1", "A", i);
    }

    // Exactly the 24 points that decided the match — the extra 6 are dropped,
    // so computeMatch never sees an over-long log (the crash the watch hit).
    expect(loadEvents(driver, "m1")).toHaveLength(24);
  });

  it("refuses points while paused", () => {
    const driver = seededDriver();
    createMatch(driver, newMatch("m1", { config: SINGLE_SET }));
    pauseMatch(driver, "m1", 500);
    scorePoint(driver, "m1", "A", 600);
    expect(loadEvents(driver, "m1")).toHaveLength(0);
  });
});
