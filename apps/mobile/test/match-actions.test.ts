import type { TeamPlayers } from "@holy-padel/db";
import {
  appendEvent,
  createMatch,
  createPlayer,
  getLiveMatch,
  getMatch,
  loadEvents,
  migrate,
} from "@holy-padel/db";
import type { MatchConfig } from "@holy-padel/scoring";
import { describe, expect, it } from "vitest";
import {
  closeLiveMatch,
  recordPoint,
  settleLiveMatches,
  undoMatchPoint,
} from "../src/lib/match-actions.ts";
import { applyWatchIntent, INTENT_PATHS } from "../src/watch/apply-intent.ts";
import { memoryDriver } from "./memory-driver.ts";

// One set: 24 straight points for A is a 6-0 win.
const ONE_SET: MatchConfig = {
  bestOf: 1,
  deuceMode: "advantage",
  thirdSet: "fullSet",
  firstServe: "A",
};
const MATCH_POINTS = 24;
const players: TeamPlayers = { A: ["nico", "javi"], B: ["marta", "leo"] };

function freshDb() {
  const driver = memoryDriver();
  migrate(driver);
  for (const id of ["nico", "javi", "marta", "leo"]) {
    createPlayer(driver, { id, name: id, createdAt: 0 });
  }
  return driver;
}

function playTo(driver: ReturnType<typeof freshDb>, id: string, points: number): void {
  for (let index = 0; index < points; index += 1) {
    appendEvent(driver, id, { winner: "A", at: 100 + index });
  }
}

describe("recordPoint", () => {
  it("saves the result on the deciding rally", () => {
    const driver = freshDb();
    createMatch(driver, { id: "m1", config: ONE_SET, players, startedAt: 0 });
    playTo(driver, "m1", MATCH_POINTS - 1);
    expect(getMatch(driver, "m1")?.status).toBe("live");

    recordPoint(driver, "m1", "A", 5000);

    const match = getMatch(driver, "m1");
    expect(match?.status).toBe("finished");
    expect(match?.winner).toBe("A");
    expect(match?.scoreLine).toBe("6-0");
    expect(match?.endedAt).toBe(5000);
  });

  it("saves a match won from the watch with no scoreboard open", () => {
    const driver = freshDb();
    createMatch(driver, { id: "m1", config: ONE_SET, players, startedAt: 0 });
    const ctx = { now: 1000, newMatchId: () => "rematch" };
    for (let index = 0; index < MATCH_POINTS; index += 1) {
      applyWatchIntent(driver, { path: INTENT_PATHS.score, body: "A" }, ctx);
    }
    expect(getMatch(driver, "m1")?.status).toBe("finished");
    expect(getLiveMatch(driver)).toBeUndefined();
  });
});

describe("undoMatchPoint", () => {
  it("reopens the match without the deciding rally", () => {
    const driver = freshDb();
    createMatch(driver, { id: "m1", config: ONE_SET, players, startedAt: 0 });
    playTo(driver, "m1", MATCH_POINTS - 1);
    recordPoint(driver, "m1", "A", 5000);

    expect(undoMatchPoint(driver, "m1")).toBe(true);

    const match = getMatch(driver, "m1");
    expect(match?.status).toBe("live");
    expect(match?.winner).toBeUndefined();
    expect(match?.scoreLine).toBeUndefined();
    expect(loadEvents(driver, "m1")).toHaveLength(MATCH_POINTS - 1);
  });

  it("refuses while another match is live", () => {
    const driver = freshDb();
    createMatch(driver, { id: "m1", config: ONE_SET, players, startedAt: 0 });
    playTo(driver, "m1", MATCH_POINTS - 1);
    recordPoint(driver, "m1", "A", 5000);
    createMatch(driver, { id: "m2", config: ONE_SET, players, startedAt: 6000 });

    expect(undoMatchPoint(driver, "m1")).toBe(false);
    expect(getMatch(driver, "m1")?.status).toBe("finished");
  });
});

describe("closeLiveMatch", () => {
  it("saves the live match as it stands", () => {
    const driver = freshDb();
    createMatch(driver, { id: "m1", config: ONE_SET, players, startedAt: 0 });
    playTo(driver, "m1", 4);

    closeLiveMatch(driver, 2000);

    const match = getMatch(driver, "m1");
    expect(match?.status).toBe("finished");
    expect(match?.winner).toBe("A");
  });
});

describe("settleLiveMatches", () => {
  it("finishes a decided match that was left live", () => {
    const driver = freshDb();
    createMatch(driver, { id: "m1", config: ONE_SET, players, startedAt: 0 });
    // The old bug: the deciding rally landed but nothing marked it finished.
    playTo(driver, "m1", MATCH_POINTS);

    expect(settleLiveMatches(driver)).toBe(1);
    const match = getMatch(driver, "m1");
    expect(match?.status).toBe("finished");
    expect(match?.scoreLine).toBe("6-0");
    expect(match?.endedAt).toBe(100 + MATCH_POINTS - 1);
  });

  it("keeps the newest undecided match live and settles the orphans", () => {
    const driver = freshDb();
    createMatch(driver, { id: "played", config: ONE_SET, players, startedAt: 0 });
    playTo(driver, "played", 4);
    createMatch(driver, { id: "empty", config: ONE_SET, players, startedAt: 10 });
    createMatch(driver, { id: "current", config: ONE_SET, players, startedAt: 20 });

    expect(settleLiveMatches(driver)).toBe(2);
    expect(getMatch(driver, "current")?.status).toBe("live");
    expect(getMatch(driver, "played")?.status).toBe("finished");
    expect(getMatch(driver, "empty")).toBeUndefined();
  });

  it("leaves a single undecided live match alone", () => {
    const driver = freshDb();
    createMatch(driver, { id: "m1", config: ONE_SET, players, startedAt: 0 });
    playTo(driver, "m1", 4);
    expect(settleLiveMatches(driver)).toBe(0);
    expect(getMatch(driver, "m1")?.status).toBe("live");
  });
});
