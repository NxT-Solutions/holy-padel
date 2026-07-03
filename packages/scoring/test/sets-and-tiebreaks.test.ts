import { describe, expect, it } from "vitest";
import type { MatchConfig } from "../src/index.ts";
import {
  ADVANTAGE_MATCH,
  gamesToSixAll,
  loveGame,
  loveSet,
  loveTieBreak,
  SUPER_TB_MATCH,
  snap,
} from "./helpers.ts";

describe("winning a set (FIP Rule 1, score pts 2-4)", () => {
  it("takes a set 6-0", () => {
    const snapshot = snap(ADVANTAGE_MATCH, loveSet("A"));
    expect(snapshot.completedSets).toEqual([{ games: { A: 6, B: 0 }, winner: "A", kind: "set" }]);
    expect(snapshot.setNumber).toBe(2);
  });

  it("requires a two-game margin at 5-5, allowing 7-5", () => {
    const fiveAll = `${loveGame("A")}${loveGame("B")}`.repeat(5);
    const atSixFive = `${fiveAll}${loveGame("A")}`;
    expect(snap(ADVANTAGE_MATCH, atSixFive).completedSets).toEqual([]);
    const sevenFive = `${atSixFive}${loveGame("A")}`;
    expect(snap(ADVANTAGE_MATCH, sevenFive).completedSets).toEqual([
      { games: { A: 7, B: 5 }, winner: "A", kind: "set" },
    ]);
  });

  it("goes to a tie-break at 6-6", () => {
    const snapshot = snap(ADVANTAGE_MATCH, gamesToSixAll());
    expect(snapshot.currentGame).toMatchObject({
      kind: "tieBreak",
      tieBreakKind: "setTieBreak",
      target: 7,
    });
    expect(snapshot.moment).toEqual({ kind: "tieBreak", setNumber: 1 });
  });

  it("records a tie-break set as 7-6 with the tie-break score", () => {
    const snapshot = snap(ADVANTAGE_MATCH, `${gamesToSixAll()}${loveTieBreak("B")}`);
    expect(snapshot.completedSets).toEqual([
      { games: { A: 6, B: 7 }, tieBreak: { A: 0, B: 7 }, winner: "B", kind: "set" },
    ]);
  });
});

describe("tie-break scoring (FIP Rule 1, tie-break pts 1-2)", () => {
  it("is won by the first pair to 7 with 2 clear", () => {
    const sixFive = `${gamesToSixAll()}${"AB".repeat(5)}A`;
    expect(snap(ADVANTAGE_MATCH, sixFive).completedSets).toEqual([]);
    const sevenFive = `${sixFive}A`;
    expect(snap(ADVANTAGE_MATCH, sevenFive).completedSets[0]?.tieBreak).toEqual({ A: 7, B: 5 });
  });

  it("continues past 7-6 until the margin is two", () => {
    const sixAll = gamesToSixAll();
    // 6-6 in the tie-break, then 7-6: still going.
    const level = `${sixAll}${"AB".repeat(6)}A`;
    const snapshot = snap(ADVANTAGE_MATCH, level);
    expect(snapshot.completedSets).toEqual([]);
    expect(snapshot.currentGame).toMatchObject({ points: { A: 7, B: 6 } });
    // 8-6 closes it.
    const closed = snap(ADVANTAGE_MATCH, `${level}A`);
    expect(closed.completedSets).toHaveLength(1);
    expect(closed.completedSets[0]?.tieBreak).toEqual({ A: 8, B: 6 });
  });
});

describe("match structure", () => {
  it("best of 3 ends at two sets", () => {
    const snapshot = snap(ADVANTAGE_MATCH, loveSet("A").repeat(2));
    expect(snapshot.finished).toBe(true);
    expect(snapshot.winner).toBe("A");
    expect(snapshot.moment).toEqual({ kind: "finished", winner: "A" });
    expect(snapshot.currentGame).toBeUndefined();
  });

  it("best of 1 ends after a single set", () => {
    const config: MatchConfig = { ...ADVANTAGE_MATCH, bestOf: 1 };
    const snapshot = snap(config, loveSet("B"));
    expect(snapshot.finished).toBe(true);
    expect(snapshot.winner).toBe("B");
  });

  it("throws when scoring past the end of the match", () => {
    const done = `${loveSet("A")}${loveSet("A")}`;
    expect(() => snap(ADVANTAGE_MATCH, `${done}A`)).toThrow(/finished/u);
  });

  it("plays a full third set when configured", () => {
    const oneSetAll = `${loveSet("A")}${loveSet("B")}`;
    const snapshot = snap(ADVANTAGE_MATCH, `${oneSetAll}${gamesToSixAll()}`);
    expect(snapshot.currentGame).toMatchObject({ kind: "tieBreak", target: 7 });
  });

  it("plays the third set without tie-break in advantage-set mode", () => {
    const config: MatchConfig = { ...ADVANTAGE_MATCH, thirdSet: "advantageSet" };
    const oneSetAll = `${loveSet("A")}${loveSet("B")}`;
    const atSixAll = snap(config, `${oneSetAll}${gamesToSixAll()}`);
    expect(atSixAll.currentGame).toMatchObject({ kind: "standard" });
    const eightSix = snap(config, `${oneSetAll}${gamesToSixAll()}${loveGame("A")}${loveGame("A")}`);
    expect(eightSix.finished).toBe(true);
    expect(eightSix.completedSets[2]).toEqual({
      games: { A: 8, B: 6 },
      winner: "A",
      kind: "set",
    });
  });
});

describe("super tie-break third set (FIP alternative score methods 1c)", () => {
  const oneSetAll = `${loveSet("A")}${loveSet("B")}`;

  it("replaces the third set at one set all", () => {
    const snapshot = snap(SUPER_TB_MATCH, oneSetAll);
    expect(snapshot.currentGame).toMatchObject({
      kind: "tieBreak",
      tieBreakKind: "superTieBreak",
      target: 10,
    });
    expect(snapshot.moment).toEqual({ kind: "superTieBreak" });
  });

  it("is won at 10 with 2 clear and decides the match", () => {
    const snapshot = snap(SUPER_TB_MATCH, `${oneSetAll}${"AB".repeat(7)}AAA`);
    expect(snapshot.finished).toBe(true);
    expect(snapshot.winner).toBe("A");
    expect(snapshot.completedSets[2]).toEqual({
      games: { A: 10, B: 7 },
      winner: "A",
      kind: "superTieBreak",
    });
  });

  it("continues past 10 until two clear", () => {
    const level = `${oneSetAll}${"AB".repeat(10)}`;
    const snapshot = snap(SUPER_TB_MATCH, level);
    expect(snapshot.finished).toBe(false);
    expect(snap(SUPER_TB_MATCH, `${level}BB`).winner).toBe("B");
  });

  it("does not replace a straight-sets win", () => {
    const snapshot = snap(SUPER_TB_MATCH, loveSet("A").repeat(2));
    expect(snapshot.finished).toBe(true);
  });
});
