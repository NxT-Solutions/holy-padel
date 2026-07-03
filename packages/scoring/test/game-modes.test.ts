import { describe, expect, it } from "vitest";
import { ADVANTAGE_MATCH, GOLDEN_MATCH, STAR_MATCH, snap } from "./helpers.ts";

function calls(config: typeof ADVANTAGE_MATCH, pattern: string): { A: string; B: string } {
  const game = snap(config, pattern).currentGame;
  if (game === undefined || game.kind !== "standard") {
    throw new Error("expected a standard game in play");
  }
  return game.calls;
}

describe("point calls", () => {
  it("walks 0 / 15 / 30 / 40", () => {
    expect(calls(ADVANTAGE_MATCH, "")).toEqual({ A: "0", B: "0" });
    expect(calls(ADVANTAGE_MATCH, "A")).toEqual({ A: "15", B: "0" });
    expect(calls(ADVANTAGE_MATCH, "AA")).toEqual({ A: "30", B: "0" });
    expect(calls(ADVANTAGE_MATCH, "AAA")).toEqual({ A: "40", B: "0" });
    expect(calls(ADVANTAGE_MATCH, "AAABB")).toEqual({ A: "40", B: "30" });
  });

  it("shows AD for the pair holding advantage", () => {
    expect(calls(ADVANTAGE_MATCH, "AAABBBA")).toEqual({ A: "AD", B: "40" });
    expect(calls(ADVANTAGE_MATCH, "AAABBBB")).toEqual({ A: "40", B: "AD" });
  });

  it("returns to 40-40 when advantage is lost", () => {
    expect(calls(ADVANTAGE_MATCH, "AAABBBAB")).toEqual({ A: "40", B: "40" });
  });
});

describe("advantage games (FIP Rule 1, option 1)", () => {
  it("wins a love game after four points", () => {
    const snapshot = snap(ADVANTAGE_MATCH, "AAAA");
    expect(snapshot.currentSetGames).toEqual({ A: 1, B: 0 });
    expect(snapshot.currentGame).toMatchObject({ points: { A: 0, B: 0 } });
  });

  it("needs two consecutive points from deuce, indefinitely", () => {
    // Five deuce cycles, then two straight points.
    const cycles = "AAABBB".concat("AB".repeat(5));
    const snapshot = snap(ADVANTAGE_MATCH, `${cycles}AA`);
    expect(snapshot.currentSetGames).toEqual({ A: 1, B: 0 });
  });

  it("does not award the game one point after deuce", () => {
    const snapshot = snap(ADVANTAGE_MATCH, "AAABBBA");
    expect(snapshot.currentSetGames).toEqual({ A: 0, B: 0 });
  });
});

describe("golden point games (FIP Rule 1, option 3)", () => {
  it("decides the game with a single point at deuce", () => {
    const snapshot = snap(GOLDEN_MATCH, "AAABBBB");
    expect(snapshot.currentSetGames).toEqual({ A: 0, B: 1 });
  });

  it("flags the deciding point as the golden point", () => {
    expect(snap(GOLDEN_MATCH, "AAABBB").moment).toEqual({ kind: "goldenPoint" });
  });

  it("still wins straightforward games at four points", () => {
    expect(snap(GOLDEN_MATCH, "ABAAA").currentSetGames).toEqual({ A: 1, B: 0 });
  });
});

describe("star point games (FIP Rule 1, option 2)", () => {
  it("keeps advantage play through deuce 2", () => {
    // deuce 1 -> advantage A -> deuce 2 -> advantage B -> deuce 3
    const toDeuceThree = "AAABBBABBA";
    const snapshot = snap(STAR_MATCH, toDeuceThree);
    expect(snapshot.currentSetGames).toEqual({ A: 0, B: 0 });
    expect(snapshot.moment).toEqual({ kind: "starPoint" });
  });

  it("decides the game on the star point at deuce 3", () => {
    const snapshot = snap(STAR_MATCH, "AAABBBABBAA");
    expect(snapshot.currentSetGames).toEqual({ A: 1, B: 0 });
  });

  it("can still be won with two clear points before deuce 3", () => {
    const snapshot = snap(STAR_MATCH, "AAABBBAA");
    expect(snapshot.currentSetGames).toEqual({ A: 1, B: 0 });
  });
});
