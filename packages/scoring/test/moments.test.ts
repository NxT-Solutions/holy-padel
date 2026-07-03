import { describe, expect, it } from "vitest";
import { statusLabel, watchStatusLabel } from "../src/index.ts";
import { ADVANTAGE_MATCH, gamesToSixAll, loveGame, loveSet, snap } from "./helpers.ts";

const NAMES = { A: "Nico & Javi", B: "Marta & Leo" };
const SHORT = { A: "N&J", B: "M&L" };

describe("moments", () => {
  it("reports game point at 40-30", () => {
    expect(snap(ADVANTAGE_MATCH, "AAABB").moment).toEqual({ kind: "gamePoint", team: "A" });
  });

  it("reports deuce and advantage", () => {
    expect(snap(ADVANTAGE_MATCH, "AAABBB").moment).toEqual({ kind: "deuce" });
    expect(snap(ADVANTAGE_MATCH, "AAABBBA").moment).toEqual({ kind: "advantage", team: "A" });
  });

  it("upgrades game point to set point when the game takes the set", () => {
    // A leads 5-0 in games and 40-0: winning the game wins the set.
    const snapshot = snap(ADVANTAGE_MATCH, `${loveGame("A").repeat(5)}AAA`);
    expect(snapshot.moment).toEqual({ kind: "setPoint", team: "A" });
  });

  it("upgrades set point to match point when the set takes the match", () => {
    const snapshot = snap(ADVANTAGE_MATCH, `${loveSet("A")}${loveGame("A").repeat(5)}AAA`);
    expect(snapshot.moment).toEqual({ kind: "matchPoint", team: "A" });
  });

  it("labels the tie-break with its set number", () => {
    const secondSetTieBreak = `${loveSet("A")}${gamesToSixAll()}`;
    expect(snap(ADVANTAGE_MATCH, secondSetTieBreak).moment).toEqual({
      kind: "tieBreak",
      setNumber: 2,
    });
  });

  it("is normal in an uneventful rally", () => {
    expect(snap(ADVANTAGE_MATCH, "AB").moment).toEqual({ kind: "normal" });
  });
});

describe("status labels (design copy)", () => {
  it("renders the phone pill strings from the design", () => {
    expect(statusLabel({ kind: "gamePoint", team: "A" }, NAMES)).toBe("GAME POINT — NICO & JAVI");
    expect(statusLabel({ kind: "deuce" }, NAMES)).toBe("DEUCE");
    expect(statusLabel({ kind: "advantage", team: "A" }, NAMES)).toBe("ADVANTAGE — NICO & JAVI");
    expect(statusLabel({ kind: "tieBreak", setNumber: 2 }, NAMES)).toBe("TIE-BREAK — SET 2");
    expect(statusLabel({ kind: "normal" }, NAMES)).toBeUndefined();
  });

  it("renders the watch strings from the design", () => {
    expect(watchStatusLabel({ kind: "gamePoint", team: "A" }, SHORT)).toBe("GAME PT");
    expect(watchStatusLabel({ kind: "deuce" }, SHORT)).toBe("DEUCE");
    expect(watchStatusLabel({ kind: "advantage", team: "A" }, SHORT)).toBe("AD · N&J");
    expect(watchStatusLabel({ kind: "tieBreak", setNumber: 2 }, SHORT)).toBe("TIE-BREAK");
  });
});
