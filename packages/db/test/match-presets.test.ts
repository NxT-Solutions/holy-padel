import { describe, expect, it } from "vitest";
import type { MatchPreset, NewMatchDefaults, SqlDriver } from "../src/index.ts";
import {
  deleteMatchPreset,
  loadLastSetup,
  loadMatchPresets,
  migrate,
  pickDefaults,
  saveLastSetup,
  saveMatchPreset,
  setSetting,
} from "../src/index.ts";
import { memoryDriver } from "./memory-driver.ts";

function freshDriver(): SqlDriver {
  const driver = memoryDriver();
  migrate(driver);
  return driver;
}

const PADEL: NewMatchDefaults = {
  ...pickDefaults(undefined),
  format: "doubles",
  sport: "padel",
  bestOf: 3,
  thirdSet: "superTieBreak",
  deuceMode: "advantage",
};

function preset(id: string, name: string, setup: NewMatchDefaults = PADEL): MatchPreset {
  return { id, name, setup };
}

describe("match presets", () => {
  it("round-trips saved presets and defaults to an empty list", () => {
    const driver = freshDriver();
    expect(loadMatchPresets(driver)).toEqual([]);

    saveMatchPreset(driver, preset("p1", "Club night"));
    saveMatchPreset(driver, preset("p2", "Training", { ...PADEL, bestOf: 1 }));

    expect(loadMatchPresets(driver)).toEqual([
      preset("p1", "Club night"),
      preset("p2", "Training", { ...PADEL, bestOf: 1 }),
    ]);
  });

  it("upserts by id without duplicating", () => {
    const driver = freshDriver();
    saveMatchPreset(driver, preset("p1", "Club night"));
    saveMatchPreset(driver, preset("p1", "Club night", { ...PADEL, deuceMode: "goldenPoint" }));

    const loaded = loadMatchPresets(driver);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.setup.deuceMode).toBe("goldenPoint");
  });

  it("replaces a same-name preset (case-insensitive) instead of stacking", () => {
    const driver = freshDriver();
    saveMatchPreset(driver, preset("p1", "Club night"));
    saveMatchPreset(driver, preset("p2", "club NIGHT", { ...PADEL, bestOf: 5, sport: "squash" }));

    const loaded = loadMatchPresets(driver);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toEqual(preset("p2", "club NIGHT", { ...PADEL, bestOf: 5, sport: "squash" }));
  });

  it("deletes by id and ignores unknown ids", () => {
    const driver = freshDriver();
    saveMatchPreset(driver, preset("p1", "Club night"));
    saveMatchPreset(driver, preset("p2", "Training"));

    deleteMatchPreset(driver, "p1");
    deleteMatchPreset(driver, "nope");
    expect(loadMatchPresets(driver).map((entry) => entry.id)).toEqual(["p2"]);
  });

  it("drops invalid entries and reads garbage JSON as empty", () => {
    const driver = freshDriver();
    setSetting(driver, "matchPresets", "{oops");
    expect(loadMatchPresets(driver)).toEqual([]);

    setSetting(driver, "matchPresets", JSON.stringify({ not: "an array" }));
    expect(loadMatchPresets(driver)).toEqual([]);

    setSetting(
      driver,
      "matchPresets",
      JSON.stringify([
        preset("good", "Good"),
        { id: "no-name", name: "  ", setup: PADEL },
        { id: "bad-setup", name: "Bad", setup: { ...PADEL, sport: "tennis" } },
        { id: "", name: "No id", setup: PADEL },
        null,
      ]),
    );
    expect(loadMatchPresets(driver)).toEqual([preset("good", "Good")]);
  });
});

describe("last setup by sport", () => {
  it("remembers each sport independently", () => {
    const driver = freshDriver();
    const padel = PADEL;
    const squash: NewMatchDefaults = { ...PADEL, sport: "squash", squashMode: "hiho" };
    saveLastSetup(driver, padel);
    saveLastSetup(driver, squash);

    expect(loadLastSetup(driver, "padel")).toEqual(padel);
    expect(loadLastSetup(driver, "squash")).toEqual(squash);
    expect(loadLastSetup(driver, "pickleball")).toBeUndefined();
  });

  it("overwrites the sport's previous setup", () => {
    const driver = freshDriver();
    saveLastSetup(driver, PADEL);
    const next: NewMatchDefaults = { ...PADEL, bestOf: 1 };
    saveLastSetup(driver, next);
    expect(loadLastSetup(driver, "padel")).toEqual(next);
  });

  it("returns undefined for garbage", () => {
    const driver = freshDriver();
    setSetting(driver, "lastSetupBySport", "not json");
    expect(loadLastSetup(driver, "padel")).toBeUndefined();

    setSetting(driver, "lastSetupBySport", JSON.stringify({ padel: { sport: "nope" } }));
    expect(loadLastSetup(driver, "padel")).toBeUndefined();
  });
});
