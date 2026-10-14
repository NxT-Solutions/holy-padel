import type { TeamPlayers } from "@holy-padel/db";
import { createMatch, createPlayer, migrate, setSetting } from "@holy-padel/db";
import type { MatchConfig } from "@holy-padel/scoring";
import { describe, expect, it } from "vitest";
import { buildLiveNotification, intentForAction } from "../src/live/build-notification.ts";
import { applyWatchIntent, INTENT_PATHS } from "../src/watch/apply-intent.ts";
import { gatherWatchInput } from "../src/watch/gather-input.ts";
import { memoryDriver } from "./memory-driver.ts";

const config: MatchConfig = {
  bestOf: 3,
  deuceMode: "advantage",
  thirdSet: "superTieBreak",
  firstServe: "A",
};
const players: TeamPlayers = { A: ["nico", "javi"], B: ["marta", "leo"] };
const ctx = { now: 60_000, newMatchId: () => "rematch" };

function liveDb() {
  const driver = memoryDriver();
  migrate(driver);
  for (const [id, name] of [
    ["nico", "Nico"],
    ["javi", "Javi"],
    ["marta", "Marta"],
    ["leo", "Leo"],
  ] as const) {
    createPlayer(driver, { id, name, createdAt: 0 });
  }
  createMatch(driver, { id: "m1", config, players, startedAt: 5000 });
  return driver;
}

function point(driver: ReturnType<typeof liveDb>, team: "A" | "B"): void {
  applyWatchIntent(driver, { path: INTENT_PATHS.score, body: team }, ctx);
}

describe("buildLiveNotification", () => {
  it("shows the point score, the match line and scoring buttons", () => {
    const driver = liveDb();
    point(driver, "A");
    point(driver, "A");
    point(driver, "B");

    const content = buildLiveNotification(gatherWatchInput(driver, 120_000), 120_000);

    expect(content?.title).toBe("N&J  30 – 15  M&L");
    expect(content?.chip).toBe("30–15");
    expect(content?.text).toContain("SET 1");
    // The clock counts from the start (no pauses), so the chronometer reads 1:55.
    expect(content?.clockBase).toBe(5000);
    expect(content?.url).toBe("holy-padel://live/m1");
    expect(content?.actions.map((action) => action.id)).toEqual(["score:A", "score:B", "undo"]);
  });

  it("follows the chosen highlight colour", () => {
    const driver = liveDb();
    setSetting(driver, "accentColor", "sky");
    expect(buildLiveNotification(gatherWatchInput(driver, 0), 0)?.color).toBe("#38BDF8");
  });

  it("stops the clock and offers resume while paused", () => {
    const driver = liveDb();
    applyWatchIntent(driver, { path: INTENT_PATHS.pause, body: "" }, ctx);

    const content = buildLiveNotification(gatherWatchInput(driver, 90_000), 90_000);

    expect(content?.clockBase).toBe(0);
    expect(content?.text).toMatch(/^PAUSED/u);
    expect(content?.actions).toEqual([{ id: "pause", label: "RESUME" }]);
  });

  it("comes down when nothing is live", () => {
    const driver = liveDb();
    applyWatchIntent(driver, { path: INTENT_PATHS.cancel, body: "" }, ctx);
    expect(buildLiveNotification(gatherWatchInput(driver, 0), 0)).toBeUndefined();
  });
});

describe("intentForAction", () => {
  it("maps buttons onto watch intents", () => {
    expect(intentForAction("score:B")).toEqual({ path: INTENT_PATHS.score, body: "B" });
    expect(intentForAction("undo")).toEqual({ path: INTENT_PATHS.undo, body: "" });
    expect(intentForAction("pause")).toEqual({ path: INTENT_PATHS.pause, body: "" });
    expect(intentForAction("bogus")).toBeUndefined();
  });
});
