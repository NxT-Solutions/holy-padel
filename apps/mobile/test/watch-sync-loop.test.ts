import type { SqlDriver, TeamPlayers } from "@holy-padel/db";
import { createMatch, createPlayer, getLiveMatch, loadEvents, migrate } from "@holy-padel/db";
import type { MatchConfig } from "@holy-padel/scoring";
import { computeMatch } from "@holy-padel/scoring";
import { describe, expect, it } from "vitest";
import { applyWatchIntent, INTENT_PATHS } from "../src/watch/apply-intent.ts";
import type { WatchState } from "../src/watch/build-state.ts";
import { buildWatchState } from "../src/watch/build-state.ts";
import { memoryDriver } from "./memory-driver.ts";

// Ties the two pure halves together over a real driver: an intent from the watch
// mutates the ledger, and the next payload the phone would push reflects it.
const config: MatchConfig = {
  bestOf: 1,
  deuceMode: "advantage",
  thirdSet: "fullSet",
  firstServe: "A",
};
const players: TeamPlayers = { A: ["nico", "javi"], B: ["marta", "leo"] };
const ctx = { now: 1000, newMatchId: () => "rematch" };

function freshDb() {
  const driver = memoryDriver();
  migrate(driver);
  for (const id of ["nico", "javi", "marta", "leo"]) {
    createPlayer(driver, { id, name: id, createdAt: 0 });
  }
  return driver;
}

// What the phone would push right now, gathered exactly like useWatchSync does.
function currentState(driver: SqlDriver): WatchState {
  const live = getLiveMatch(driver);
  if (live === undefined) {
    return buildWatchState({ ownerId: "nico", now: 0 });
  }
  const snapshot = computeMatch(live.config, loadEvents(driver, live.id));
  return buildWatchState({ ownerId: "nico", now: 0, live: { match: live, snapshot } });
}

describe("watch sync loop", () => {
  it("score intents advance the mirrored payload; undo reverses it", () => {
    const driver = freshDb();
    createMatch(driver, { id: "m1", config, players, startedAt: 0, court: "COURT 4" });

    expect(currentState(driver).phase).toBe("live");
    expect(currentState(driver).pointA).toBe("0");

    applyWatchIntent(driver, { path: INTENT_PATHS.score, body: "A" }, ctx);
    expect(currentState(driver).pointA).toBe("15");

    applyWatchIntent(driver, { path: INTENT_PATHS.score, body: "A" }, ctx);
    expect(currentState(driver).pointA).toBe("30");

    applyWatchIntent(driver, { path: INTENT_PATHS.undo, body: "" }, ctx);
    expect(currentState(driver).pointA).toBe("15");
  });

  it("scoring the match out flips the payload to won", () => {
    const driver = freshDb();
    createMatch(driver, { id: "m1", config, players, startedAt: 0 });

    // best-of-1, six love games = 24 straight points to A.
    for (let point = 0; point < 24; point += 1) {
      applyWatchIntent(driver, { path: INTENT_PATHS.score, body: "A" }, ctx);
    }

    const state = currentState(driver);
    expect(state.phase).toBe("won");
    expect(state.won?.winnerShort).toBe("N&J");
    expect(state.games).toBe("6-0");
  });
});
