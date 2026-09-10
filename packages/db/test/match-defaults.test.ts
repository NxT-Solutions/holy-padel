import type { MatchConfig } from "@holy-padel/scoring";
import { describe, expect, it } from "vitest";
import type { MatchDraft, SqlDriver } from "../src/index.ts";
import {
  clearMatchDraft,
  loadMatchDefaults,
  loadMatchDraft,
  migrate,
  pickDefaults,
  resolveNewMatchDefaults,
  saveMatchDefaults,
  saveMatchDraft,
  setSetting,
} from "../src/index.ts";
import { memoryDriver } from "./memory-driver.ts";

const SQUASH_CONFIG: MatchConfig = {
  sport: "squash",
  bestOf: 5,
  deuceMode: "advantage",
  thirdSet: "fullSet",
  squashMode: "hiho",
  squashTarget: 9,
  squashTiebreak: "choice",
  squashServeBoxes: "left",
  firstServe: "B",
};

function freshDriver(): SqlDriver {
  const driver = memoryDriver();
  migrate(driver);
  return driver;
}

describe("pickDefaults", () => {
  it("falls back to the squash-first built-ins without a config", () => {
    expect(pickDefaults(undefined)).toEqual({
      format: "singles",
      bestOf: 3,
      firstServe: "undecided",
      sport: "squash",
      thirdSet: "superTieBreak",
      deuceMode: "advantage",
      squashMode: "par",
      squashTarget: 11,
      squashTiebreak: "winByTwo",
      squashServeBoxes: "player",
      pbTarget: 11,
      pbTiebreak: "winByTwo",
    });
  });

  it("seeds the squash options from a squash config", () => {
    const defaults = pickDefaults(SQUASH_CONFIG);
    expect(defaults.sport).toBe("squash");
    expect(defaults.format).toBe("singles");
    expect(defaults.bestOf).toBe(5);
    expect(defaults.squashMode).toBe("hiho");
    expect(defaults.squashTarget).toBe(9);
    expect(defaults.squashTiebreak).toBe("choice");
    expect(defaults.squashServeBoxes).toBe("left");
    expect(defaults.firstServe).toBe("B");
  });

  it("keeps padel doubles by default", () => {
    const padel: MatchConfig = {
      sport: "padel",
      bestOf: 3,
      deuceMode: "advantage",
      thirdSet: "fullSet",
      firstServe: "A",
    };
    expect(pickDefaults(padel).format).toBe("doubles");
  });
});

describe("stored match defaults", () => {
  it("round-trips the saved defaults", () => {
    const driver = freshDriver();
    const defaults = pickDefaults(undefined);
    saveMatchDefaults(driver, defaults);
    expect(loadMatchDefaults(driver)).toEqual(defaults);
  });

  it("returns undefined for garbage or invalid blobs", () => {
    const driver = freshDriver();
    const defaults = pickDefaults(undefined);
    saveMatchDefaults(driver, defaults);

    setSetting(driver, "matchDefaults", "{oops");
    expect(loadMatchDefaults(driver)).toBeUndefined();

    setSetting(driver, "matchDefaults", JSON.stringify({ ...defaults, bestOf: 4 }));
    expect(loadMatchDefaults(driver)).toBeUndefined();

    setSetting(driver, "matchDefaults", JSON.stringify({ ...defaults, sport: "tennis" }));
    expect(loadMatchDefaults(driver)).toBeUndefined();
  });
});

describe("stored match draft", () => {
  it("round-trips the draft with and without a partner", () => {
    const driver = freshDriver();
    const draft: MatchDraft = {
      ...pickDefaults(undefined),
      teamA1: "nico",
      teamB: ["javi", "marta"],
    };
    saveMatchDraft(driver, draft);
    expect(loadMatchDraft(driver)).toEqual(draft);

    saveMatchDraft(driver, { ...draft, partner: "javi" });
    expect(loadMatchDraft(driver)?.partner).toBe("javi");
  });

  it("clearing leaves no draft", () => {
    const driver = freshDriver();
    saveMatchDraft(driver, {
      ...pickDefaults(undefined),
      teamA1: "nico",
      partner: "javi",
      teamB: ["marta", "leo"],
    });
    clearMatchDraft(driver);
    expect(loadMatchDraft(driver)).toBeUndefined();
  });

  it("returns undefined for garbage or invalid drafts", () => {
    const driver = freshDriver();
    const draft: MatchDraft = { ...pickDefaults(undefined), teamA1: "nico", teamB: [] };
    saveMatchDraft(driver, draft);

    setSetting(driver, "matchDraft", "not json");
    expect(loadMatchDraft(driver)).toBeUndefined();

    setSetting(driver, "matchDraft", JSON.stringify({ ...draft, sport: "tennis" }));
    expect(loadMatchDraft(driver)).toBeUndefined();

    setSetting(driver, "matchDraft", JSON.stringify({ ...draft, teamA1: "" }));
    expect(loadMatchDraft(driver)).toBeUndefined();

    setSetting(driver, "matchDraft", JSON.stringify({ ...draft, teamB: ["javi", "marta", "leo"] }));
    expect(loadMatchDraft(driver)).toBeUndefined();
  });
});

describe("resolveNewMatchDefaults precedence", () => {
  const lastConfig: MatchConfig = {
    sport: "squash",
    bestOf: 5,
    deuceMode: "advantage",
    thirdSet: "fullSet",
    squashMode: "par",
    squashTarget: 15,
    squashTiebreak: "winByTwo",
    firstServe: "A",
  };
  const draft: MatchDraft = {
    ...pickDefaults(undefined),
    teamA1: "nico",
    teamB: [],
    sport: "squash",
    squashMode: "hiho",
  };
  const saved = { ...pickDefaults(undefined), sport: "pickleball" as const };

  it("prefers the in-progress draft, then saved defaults, then the last match", () => {
    expect(resolveNewMatchDefaults({ draft, saved, lastConfig }).sport).toBe("squash");
    expect(resolveNewMatchDefaults({ draft, saved, lastConfig }).squashMode).toBe("hiho");
    expect(resolveNewMatchDefaults({ saved, lastConfig }).sport).toBe("pickleball");
    expect(resolveNewMatchDefaults({ lastConfig }).squashTarget).toBe(15);
    expect(resolveNewMatchDefaults({}).sport).toBe("squash");
  });
});
