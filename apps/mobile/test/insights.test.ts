import { migrate, setSetting } from "@holy-padel/db";
import { describe, expect, it } from "vitest";
import { seedIfEmpty } from "../src/db/seed.ts";
import {
  computeInsights,
  loadInsightData,
  MAX_HR_KEY,
  resolveMaxHr,
  sportsPlayed,
} from "../src/lib/insights.ts";
import { memoryDriver } from "./memory-driver.ts";

function seeded() {
  const driver = memoryDriver();
  migrate(driver);
  seedIfEmpty(driver);
  return driver;
}

function seededData() {
  return loadInsightData(seeded());
}

describe("computeInsights over the seed", () => {
  const data = seededData();
  const all = computeInsights(data, "nico", "all", 190);

  it("covers every finished match and every rally", () => {
    const rallies = data.reduce(
      (sum, entry) => sum + entry.events.filter((event) => event.kind !== "serve").length,
      0,
    );
    expect(all.matches).toBe(data.length);
    expect(all.clutch.points.of).toBe(rallies);
    expect(all.clutch.pressure.of).toBeLessThan(rallies);
  });

  it("records each match once per opponent", () => {
    const rivalResults = all.rivals.reduce((sum, rival) => sum + rival.won + rival.lost, 0);
    expect(rivalResults).toBeGreaterThanOrEqual(all.matches);
    expect(all.rivals.every((rival) => rival.playerId !== "nico")).toBe(true);
    expect(all.partners.every((partner) => partner.playerId !== "nico")).toBe(true);
  });

  it("reads the watch-tracked match into the trend and zones", () => {
    expect(all.trend.length).toBeGreaterThan(0);
    expect(all.trend[0]?.avgBpm).toBeGreaterThan(0);
    expect(all.zones?.some((ms) => ms > 0)).toBe(true);
  });

  it("filters by sport", () => {
    const sports = sportsPlayed(data);
    const perSport = sports.map((sport) => computeInsights(data, "nico", sport, 190).matches);
    expect(perSport.reduce((sum, count) => sum + count, 0)).toBe(all.matches);
  });
});

describe("resolveMaxHr", () => {
  it("estimates from the highest reading until one is set", () => {
    const driver = seeded();
    const estimate = resolveMaxHr(driver);
    expect(estimate.estimated).toBe(true);
    expect(estimate.bpm).toBeGreaterThanOrEqual(185);

    setSetting(driver, MAX_HR_KEY, "201");
    expect(resolveMaxHr(driver)).toEqual({ bpm: 201, estimated: false });

    setSetting(driver, MAX_HR_KEY, "nonsense");
    expect(resolveMaxHr(driver).estimated).toBe(true);
  });
});
