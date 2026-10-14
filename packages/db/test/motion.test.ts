import { describe, expect, it } from "vitest";
import type { SqlDriver } from "../src/index.ts";
import { loadMatchMotion, migrate, saveMatchMotion, setSetting } from "../src/index.ts";
import { memoryDriver } from "./memory-driver.ts";

function freshDriver(): SqlDriver {
  const driver = memoryDriver();
  migrate(driver);
  return driver;
}

describe("match motion", () => {
  it("round-trips the movement series", () => {
    const driver = freshDriver();
    const samples = [
      { t: 10_000, steps: 14, meters: 9.5 },
      { t: 20_000, steps: 21, meters: 15 },
    ];
    saveMatchMotion(driver, "m1", samples);
    expect(loadMatchMotion(driver, "m1")).toEqual(samples);
    expect(loadMatchMotion(driver, "other")).toBeUndefined();
  });

  it("ignores an empty save and garbage storage", () => {
    const driver = freshDriver();
    saveMatchMotion(driver, "m1", []);
    expect(loadMatchMotion(driver, "m1")).toBeUndefined();
    setSetting(driver, "motion:m2", "not json");
    expect(loadMatchMotion(driver, "m2")).toBeUndefined();
  });
});
