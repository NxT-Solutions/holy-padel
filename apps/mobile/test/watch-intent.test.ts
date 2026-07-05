import type { TeamPlayers } from "@holy-padel/db";
import {
  appendEvent,
  createMatch,
  createPlayer,
  finishMatch,
  getLiveMatch,
  getMatch,
  loadEvents,
  migrate,
} from "@holy-padel/db";
import type { MatchConfig } from "@holy-padel/scoring";
import { describe, expect, it } from "vitest";
import { applyWatchIntent, INTENT_PATHS } from "../src/watch/apply-intent.ts";
import { memoryDriver } from "./memory-driver.ts";

const config: MatchConfig = {
  bestOf: 3,
  deuceMode: "advantage",
  thirdSet: "superTieBreak",
  firstServe: "A",
};
const players: TeamPlayers = { A: ["nico", "javi"], B: ["marta", "leo"] };
const ctx = { now: 1000, newMatchId: () => "rematch" };

function freshDb() {
  const driver = memoryDriver();
  migrate(driver);
  // Matches carry foreign keys to players, so the roster must exist first.
  for (const id of ["nico", "javi", "marta", "leo"]) {
    createPlayer(driver, { id, name: id, createdAt: 0 });
  }
  return driver;
}

describe("applyWatchIntent", () => {
  it("scores points on the live match", () => {
    const driver = freshDb();
    createMatch(driver, { id: "m1", config, players, startedAt: 0 });

    applyWatchIntent(driver, { path: INTENT_PATHS.score, body: "A" }, ctx);
    applyWatchIntent(driver, { path: INTENT_PATHS.score, body: "B" }, ctx);

    expect(loadEvents(driver, "m1").map((event) => event.winner)).toEqual(["A", "B"]);
  });

  it("ignores an invalid score body", () => {
    const driver = freshDb();
    createMatch(driver, { id: "m1", config, players, startedAt: 0 });

    applyWatchIntent(driver, { path: INTENT_PATHS.score, body: "X" }, ctx);

    expect(loadEvents(driver, "m1")).toHaveLength(0);
  });

  it("undoes the last point", () => {
    const driver = freshDb();
    createMatch(driver, { id: "m1", config, players, startedAt: 0 });
    appendEvent(driver, "m1", { winner: "A", at: 0 });
    appendEvent(driver, "m1", { winner: "B", at: 0 });

    applyWatchIntent(driver, { path: INTENT_PATHS.undo, body: "" }, ctx);

    expect(loadEvents(driver, "m1").map((event) => event.winner)).toEqual(["A"]);
  });

  it("rematches the last finished lineup when idle", () => {
    const driver = freshDb();
    createMatch(driver, { id: "m1", config, players, startedAt: 0, court: "COURT 4" });
    finishMatch(driver, "m1", { winner: "A", endedAt: 10, scoreLine: "6-0 · 6-0" });

    applyWatchIntent(driver, { path: INTENT_PATHS.startLast, body: "" }, ctx);

    const live = getLiveMatch(driver);
    expect(live?.id).toBe("rematch");
    expect(live?.players).toEqual(players);
    expect(live?.court).toBe("COURT 4");
  });

  it("does not rematch while a match is already live", () => {
    const driver = freshDb();
    createMatch(driver, { id: "m1", config, players, startedAt: 0 });

    applyWatchIntent(driver, { path: INTENT_PATHS.startLast, body: "" }, ctx);

    expect(getLiveMatch(driver)?.id).toBe("m1");
  });

  it("toggles pause and resume, banking the interval", () => {
    const driver = freshDb();
    createMatch(driver, { id: "m1", config, players, startedAt: 0 });

    applyWatchIntent(driver, { path: INTENT_PATHS.pause, body: "" }, { ...ctx, now: 1000 });
    expect(getMatch(driver, "m1")?.pausedAt).toBe(1000);

    applyWatchIntent(driver, { path: INTENT_PATHS.pause, body: "" }, { ...ctx, now: 3000 });
    const match = getMatch(driver, "m1");
    expect(match?.pausedAt).toBeUndefined();
    expect(match?.pausedMs).toBe(2000);
  });

  it("ignores score intents while paused", () => {
    const driver = freshDb();
    createMatch(driver, { id: "m1", config, players, startedAt: 0 });

    applyWatchIntent(driver, { path: INTENT_PATHS.pause, body: "" }, ctx);
    applyWatchIntent(driver, { path: INTENT_PATHS.score, body: "A" }, ctx);

    expect(loadEvents(driver, "m1")).toHaveLength(0);
  });

  it("stops an in-progress match by saving it, crediting the leader", () => {
    const driver = freshDb();
    // Court time's up mid-play: A leads the first game 30-0. Don't lose the score.
    createMatch(driver, { id: "m1", config, players, startedAt: 0 });
    appendEvent(driver, "m1", { winner: "A", at: 0 });
    appendEvent(driver, "m1", { winner: "A", at: 0 });

    applyWatchIntent(driver, { path: INTENT_PATHS.stop, body: "" }, { ...ctx, now: 5000 });

    expect(getLiveMatch(driver)).toBeUndefined();
    const match = getMatch(driver, "m1");
    expect(match?.status).toBe("finished");
    expect(match?.winner).toBe("A");
    // The partial set (still 0-0 in games) is preserved as the saved line.
    expect(match?.scoreLine).toBe("0-0");
  });

  it("cancels an in-progress match by discarding it", () => {
    const driver = freshDb();
    createMatch(driver, { id: "m1", config, players, startedAt: 0 });
    appendEvent(driver, "m1", { winner: "A", at: 0 });

    applyWatchIntent(driver, { path: INTENT_PATHS.cancel, body: "" }, ctx);

    expect(getLiveMatch(driver)).toBeUndefined();
    expect(getMatch(driver, "m1")).toBeUndefined();
  });

  it("stops a finished match by persisting the engine's win", () => {
    const driver = freshDb();
    // bestOf:1 finishes at 6 love games — 24 points to A wins the set 6-0.
    createMatch(driver, { id: "m1", config: { ...config, bestOf: 1 }, players, startedAt: 0 });
    for (let i = 0; i < 24; i += 1) {
      appendEvent(driver, "m1", { winner: "A", at: 0 });
    }

    applyWatchIntent(driver, { path: INTENT_PATHS.stop, body: "" }, { ...ctx, now: 5000 });

    expect(getLiveMatch(driver)).toBeUndefined();
    const match = getMatch(driver, "m1");
    expect(match?.status).toBe("finished");
    expect(match?.winner).toBe("A");
    expect(match?.scoreLine).toBe("6-0");
  });

  it("keeps the legacy `end` intent as an alias for stop-and-save", () => {
    const driver = freshDb();
    createMatch(driver, { id: "m1", config, players, startedAt: 0 });
    appendEvent(driver, "m1", { winner: "B", at: 0 });

    applyWatchIntent(driver, { path: INTENT_PATHS.end, body: "" }, { ...ctx, now: 5000 });

    expect(getLiveMatch(driver)).toBeUndefined();
    expect(getMatch(driver, "m1")?.status).toBe("finished");
    expect(getMatch(driver, "m1")?.winner).toBe("B");
  });
});
