import type { MatchConfig } from "@holy-padel/scoring";
import { computeMatch } from "@holy-padel/scoring";
import { describe, expect, it } from "vitest";
import { createMatch, finishMatch, getMatch, loadEvents } from "../src/index.ts";
import { repairMissingEvents } from "../src/repair.ts";
import { migrate } from "../src/schema.ts";
import { memoryDriver } from "./memory-driver.ts";

/** HIHO to 11, win by 2, best of 1 — the config the lost matches used. */
const HIHO = {
  sport: "squash",
  bestOf: 1,
  deuceMode: "advantage",
  thirdSet: "fullSet",
  squashMode: "hiho",
  squashTarget: 11,
  squashTiebreak: "winByTwo",
  squashServeBoxes: "player",
  firstServe: "A",
  firstServePending: false,
  firstServeOriginallyUndecided: false,
} as const;

function brokenMatch(
  driver: ReturnType<typeof memoryDriver>,
  id: string,
  scoreLine: string,
  winner: "A" | "B" = "A",
): void {
  createMatch(driver, {
    id,
    config: HIHO,
    players: { A: ["nico", undefined], B: ["marta", undefined] },
    startedAt: 1000,
  });
  finishMatch(driver, id, { winner, endedAt: 61_000, scoreLine });
}

function freshDriver(): ReturnType<typeof memoryDriver> {
  const driver = memoryDriver();
  migrate(driver);
  createPlayerRows(driver);
  return driver;
}

function createPlayerRows(driver: ReturnType<typeof memoryDriver>): void {
  for (const id of ["nico", "marta"]) {
    driver.execute(
      "INSERT INTO players (id, name, is_owner, removed, created_at) VALUES (?, ?, 1, 0, 0) ON CONFLICT DO NOTHING",
      [id, id],
    );
  }
}

describe("repairMissingEvents", () => {
  it("rebuilds a lost HIHO ledger from the score line", () => {
    const driver = freshDriver();
    brokenMatch(driver, "m1", "13-11");
    expect(loadEvents(driver, "m1")).toHaveLength(0);

    expect(repairMissingEvents(driver)).toBe(1);

    const events = loadEvents(driver, "m1");
    expect(events.length).toBeGreaterThan(20);
    const snapshot = computeMatch(HIHO, events);
    expect(snapshot.finished).toBe(true);
    expect(snapshot.winner).toBe("A");
    expect(snapshot.completedSets[0]?.games).toEqual({ A: 13, B: 11 });
  });

  it("handles a win for team B and never lands mid-game", () => {
    const driver = freshDriver();
    brokenMatch(driver, "m1", "7-11", "B");
    expect(repairMissingEvents(driver)).toBe(1);
    const snapshot = computeMatch(HIHO, loadEvents(driver, "m1"));
    expect(snapshot.winner).toBe("B");
    expect(snapshot.completedSets[0]?.games).toEqual({ A: 7, B: 11 });
  });

  it("repairs several games including a 11-0 bagel", () => {
    const driver = freshDriver();
    const bestOf3: MatchConfig = { ...HIHO, bestOf: 3 };
    createMatch(driver, {
      id: "m2",
      config: bestOf3,
      players: { A: ["nico", undefined], B: ["marta", undefined] },
      startedAt: 1000,
    });
    finishMatch(driver, "m2", { winner: "A", endedAt: 61_000, scoreLine: "11-0 · 9-11 · 12-10" });

    expect(repairMissingEvents(driver)).toBe(1);
    const snapshot = computeMatch(bestOf3, loadEvents(driver, "m2"));
    expect(snapshot.completedSets.map((set) => set.games)).toEqual([
      { A: 11, B: 0 },
      { A: 9, B: 11 },
      { A: 12, B: 10 },
    ]);
  });

  it("is idempotent and leaves matches that already have events", () => {
    const driver = freshDriver();
    brokenMatch(driver, "m1", "11-8");
    expect(repairMissingEvents(driver)).toBe(1);
    const count = loadEvents(driver, "m1").length;
    expect(repairMissingEvents(driver)).toBe(0);
    expect(loadEvents(driver, "m1")).toHaveLength(count);
  });

  it("skips finished matches without a score line", () => {
    const driver = freshDriver();
    createMatch(driver, {
      id: "m3",
      config: HIHO,
      players: { A: ["nico", undefined], B: ["marta", undefined] },
      startedAt: 1000,
    });
    finishMatch(driver, "m3", { winner: "A", endedAt: 61_000, scoreLine: "" });
    expect(repairMissingEvents(driver)).toBe(0);
  });

  it("keeps the stored winner consistent with the fold", () => {
    const driver = freshDriver();
    brokenMatch(driver, "m1", "13-11");
    repairMissingEvents(driver);
    const stored = getMatch(driver, "m1");
    const snapshot = computeMatch(HIHO, loadEvents(driver, "m1"));
    expect(stored?.winner).toBe(snapshot.winner);
  });
});
