import type { NewMatchDefaults } from "@holy-padel/db";
import { pickDefaults } from "@holy-padel/db";
import { describe, expect, it } from "vitest";
import { sportRules, switchSport } from "../src/lib/match-setup.ts";

const BASE: NewMatchDefaults = {
  ...pickDefaults(undefined),
  sport: "padel",
  format: "doubles",
  bestOf: 3,
  thirdSet: "superTieBreak",
  deuceMode: "advantage",
  firstServe: "undecided",
};

describe("switchSport", () => {
  it("is a no-op when the sport is unchanged", () => {
    expect(switchSport(BASE, "padel", undefined)).toBe(BASE);
  });

  it("applies the new sport's remembered rules wholesale", () => {
    const remembered: NewMatchDefaults = {
      ...BASE,
      sport: "squash",
      format: "singles",
      bestOf: 5,
      squashMode: "hiho",
      squashTarget: 9,
      squashTiebreak: "choice",
      squashServeBoxes: "left",
    };
    const next = switchSport(BASE, "squash", remembered);
    expect(next.sport).toBe("squash");
    expect(next.format).toBe("singles");
    expect(next.bestOf).toBe(5);
    expect(next.squashMode).toBe("hiho");
    expect(next.squashTarget).toBe(9);
    expect(next.squashServeBoxes).toBe("left");
    // The other sport's rules and the first-serve pick are left alone.
    expect(next.thirdSet).toBe(BASE.thirdSet);
    expect(next.firstServe).toBe("undecided");
  });

  it("carries the current rules over when the sport has no memory", () => {
    const next = switchSport(BASE, "pickleball", undefined);
    expect(next.sport).toBe("pickleball");
    expect(next.thirdSet).toBe("superTieBreak");
    expect(next.bestOf).toBe(3);
  });

  it("drops a stale squash best-of-5 when leaving squash", () => {
    const next = switchSport({ ...BASE, sport: "squash", bestOf: 5 }, "padel", undefined);
    expect(next.bestOf).toBe(3);
  });

  it("keeps best-of-5 when switching into squash", () => {
    const next = switchSport({ ...BASE, bestOf: 5 }, "squash", undefined);
    expect(next.bestOf).toBe(5);
  });
});

describe("sportRules", () => {
  it("scopes each sport's rules", () => {
    expect(Object.keys(sportRules({ ...BASE, sport: "squash" })).sort()).toEqual([
      "bestOf",
      "format",
      "squashMode",
      "squashServeBoxes",
      "squashTarget",
      "squashTiebreak",
    ]);
    expect(Object.keys(sportRules({ ...BASE, sport: "pickleball" })).sort()).toEqual([
      "bestOf",
      "format",
      "pbTarget",
      "pbTiebreak",
    ]);
    expect(Object.keys(sportRules(BASE)).sort()).toEqual([
      "bestOf",
      "deuceMode",
      "format",
      "thirdSet",
    ]);
  });
});
