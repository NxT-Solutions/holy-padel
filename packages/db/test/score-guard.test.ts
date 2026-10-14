import type { MatchConfig } from "@holy-padel/scoring";
import { describe, expect, it } from "vitest";
import {
  createMatch,
  getMatch,
  loadEvents,
  pauseMatch,
  removeLastEvent,
  scorePoint,
} from "../src/index.ts";
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

describe("undecided serve flows through scorePoint", () => {
  const Undecided: MatchConfig = {
    ...SINGLE_SET,
    firstServePending: true,
    firstServeOriginallyUndecided: true,
  };

  it("a tap with an undecided first serve chooses the server, scoring no rally", () => {
    const driver = seededDriver();
    createMatch(driver, newMatch("m1", { config: Undecided }));
    scorePoint(driver, "m1", "B", 1);
    expect(loadEvents(driver, "m1")).toHaveLength(0);
    // The pending flag cleared and the serve went to B — the next tap scores.
    scorePoint(driver, "m1", "A", 2);
    expect(loadEvents(driver, "m1").map((event) => event.winner)).toEqual(["A"]);
  });

  it("undoing back to an empty ledger restores an originally-undecided first serve", () => {
    const driver = seededDriver();
    createMatch(driver, newMatch("m1", { config: Undecided }));
    scorePoint(driver, "m1", "A", 1); // chooses the server
    scorePoint(driver, "m1", "A", 2); // first rally
    removeLastEvent(driver, "m1");
    removeLastEvent(driver, "m1");
    const restored = getMatch(driver, "m1");
    expect(restored?.config.firstServePending).toBe(true);
    // The tap-to-decide flow works again after the undo.
    scorePoint(driver, "m1", "B", 3);
    expect(loadEvents(driver, "m1")).toHaveLength(0);
  });
});
