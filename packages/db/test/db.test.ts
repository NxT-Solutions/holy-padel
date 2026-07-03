import { computeMatch } from "@holy-padel/scoring";
import { describe, expect, it } from "vitest";
import {
  countMatches,
  createMatch,
  databaseSizeBytes,
  deleteMatch,
  finishMatch,
  getLiveMatch,
  getMatch,
  getOwner,
  listMatches,
  listRoster,
  loadEvents,
  migrate,
  removeLastEvent,
  reopenMatch,
} from "../src/index.ts";
import { CONFIG, newMatch, nextTimestamp, seededDriver, storeMatchWithPoints } from "./fixtures.ts";
import { memoryDriver } from "./memory-driver.ts";

describe("schema", () => {
  it("migrates idempotently", () => {
    const driver = memoryDriver();
    migrate(driver);
    migrate(driver);
    expect(countMatches(driver)).toBe(0);
    expect(databaseSizeBytes(driver)).toBeGreaterThan(0);
  });
});

describe("players", () => {
  it("stores the owner profile", () => {
    const driver = seededDriver();
    const owner = getOwner(driver);
    expect(owner).toMatchObject({ id: "nico", name: "Nico", club: "Club Padel Norte" });
  });

  it("ranks the roster by matches played with the owner", () => {
    const driver = seededDriver();
    storeMatchWithPoints(driver, "m1", "");
    storeMatchWithPoints(driver, "m2", "");
    const roster = listRoster(driver);
    expect(
      roster
        .map((entry) => entry.id)
        .slice(0, 3)
        .sort(),
    ).toEqual(["javi", "leo", "marta"]);
    const marta = roster.find((entry) => entry.id === "marta");
    expect(marta?.matchesWithOwner).toBe(2);
    const ana = roster.find((entry) => entry.id === "ana");
    expect(ana?.matchesWithOwner).toBe(0);
    expect(roster.some((entry) => entry.id === "nico")).toBe(false);
  });
});

describe("matches and events", () => {
  it("round-trips a match with its point events", () => {
    const driver = seededDriver();
    const events = storeMatchWithPoints(driver, "m1", "AABBBA");
    expect(loadEvents(driver, "m1")).toEqual(events);
    const stored = getMatch(driver, "m1");
    expect(stored).toMatchObject({
      status: "live",
      config: CONFIG,
      court: "Court 4",
      names: { A: ["Nico", "Javi"], B: ["Marta", "Leo"] },
    });
  });

  it("supports undo by removing the last event", () => {
    const driver = seededDriver();
    const events = storeMatchWithPoints(driver, "m1", "AAB");
    removeLastEvent(driver, "m1");
    expect(loadEvents(driver, "m1")).toEqual(events.slice(0, 2));
  });

  it("finds the live match and finishes it", () => {
    const driver = seededDriver();
    storeMatchWithPoints(driver, "m1", "AAAA");
    expect(getLiveMatch(driver)?.id).toBe("m1");
    finishMatch(driver, "m1", { winner: "A", endedAt: nextTimestamp(), scoreLine: "6-4 · 7-5" });
    expect(getLiveMatch(driver)).toBeUndefined();
    expect(getMatch(driver, "m1")).toMatchObject({
      status: "finished",
      winner: "A",
      scoreLine: "6-4 · 7-5",
    });
  });

  it("reopens a finished match for undo", () => {
    const driver = seededDriver();
    storeMatchWithPoints(driver, "m1", "AAAA");
    finishMatch(driver, "m1", { winner: "A", endedAt: nextTimestamp(), scoreLine: "6-0 · 6-0" });
    reopenMatch(driver, "m1");
    expect(getMatch(driver, "m1")).toMatchObject({ status: "live", scoreLine: undefined });
  });

  it("deletes a match together with its events", () => {
    const driver = seededDriver();
    storeMatchWithPoints(driver, "m1", "ABAB");
    deleteMatch(driver, "m1");
    expect(getMatch(driver, "m1")).toBeUndefined();
    expect(loadEvents(driver, "m1")).toEqual([]);
  });

  it("lists matches newest first", () => {
    const driver = seededDriver();
    createMatch(driver, newMatch("older"));
    createMatch(driver, newMatch("newer"));
    expect(listMatches(driver).map((match) => match.id)).toEqual(["newer", "older"]);
  });
});

describe("integration with the scoring engine", () => {
  it("resumes a live match to the identical snapshot", () => {
    const driver = seededDriver();
    const events = storeMatchWithPoints(driver, "m1", "AAABBBABAABBBB");
    const resumed = computeMatch(CONFIG, loadEvents(driver, "m1"));
    expect(resumed).toEqual(computeMatch(CONFIG, events));
    expect(resumed.finished).toBe(false);
  });
});
