import type { MatchSummary } from "@holy-padel/db";
import type { MatchConfig, PointEvent, TeamId } from "@holy-padel/scoring";
import { computeMatch } from "@holy-padel/scoring";
import { describe, expect, it } from "vitest";
import { buildWatchState } from "../src/watch/build-state.ts";

// Wednesday 2026-07-01 12:00 local; the match started 47 minutes earlier.
const NOW = new Date(2026, 6, 1, 12, 0).getTime();
const STARTED = NOW - 47 * 60_000;

const bestOfThree: MatchConfig = {
  bestOf: 3,
  deuceMode: "advantage",
  thirdSet: "superTieBreak",
  firstServe: "A",
};

function baseMatch(overrides: Partial<MatchSummary> = {}): MatchSummary {
  return {
    id: "m1",
    status: "live",
    config: bestOfThree,
    players: { A: ["nico", "javi"], B: ["marta", "leo"] },
    court: "COURT 4",
    location: undefined,
    startedAt: STARTED,
    endedAt: undefined,
    winner: undefined,
    scoreLine: undefined,
    names: { A: ["Nico", "Javi"], B: ["Marta", "Leo"] },
    ...overrides,
  };
}

function wins(team: TeamId, count: number): PointEvent[] {
  return Array.from({ length: count }, () => ({ winner: team, at: 0 }));
}

describe("buildWatchState", () => {
  it("mirrors a live game — serving, point calls, clock and status", () => {
    // A 40, B 15 in the opening game: A holds game point.
    const events: PointEvent[] = [...wins("A", 3), ...wins("B", 1)];
    const snapshot = computeMatch(bestOfThree, events);

    const state = buildWatchState({
      ownerId: "nico",
      now: NOW,
      live: { match: baseMatch(), snapshot },
    });

    expect(state.phase).toBe("live");
    expect(state.teamA).toEqual({ short: "N&J", serving: true });
    expect(state.teamB).toEqual({ short: "M&L", serving: false });
    expect(state.pointA).toBe("40");
    expect(state.pointB).toBe("15");
    expect(state.games).toBe("0-0");
    expect(state.setLabel).toBe("SET 1");
    expect(state.clock).toBe("0:47");
    expect(state.court).toBe("COURT 4");
    expect(state.startedAt).toBe(STARTED);
    expect(state.status).toBe("GAME PT");
    expect(state.won).toBeUndefined();
    expect(state.last).toBeUndefined();
  });

  it("labels the deciding super tie-break", () => {
    // Set 1 to A (6-0), set 2 to B (6-0), then one point into the super tie-break.
    const events: PointEvent[] = [...wins("A", 24), ...wins("B", 24), ...wins("A", 1)];
    const snapshot = computeMatch(bestOfThree, events);

    const state = buildWatchState({
      ownerId: "nico",
      now: NOW,
      live: { match: baseMatch(), snapshot },
    });

    expect(state.phase).toBe("live");
    expect(state.setLabel).toBe("SUPER TB");
    expect(state.pointA).toBe("1");
    expect(state.pointB).toBe("0");
  });

  it("celebrates a finished match", () => {
    const singleSet: MatchConfig = { ...bestOfThree, bestOf: 1, thirdSet: "fullSet" };
    const snapshot = computeMatch(singleSet, wins("A", 24)); // 6-0 to A
    expect(snapshot.finished).toBe(true);

    const state = buildWatchState({
      ownerId: "nico",
      now: NOW,
      live: { match: baseMatch({ config: singleSet }), snapshot },
    });

    expect(state.phase).toBe("won");
    expect(state.games).toBe("6-0");
    expect(state.pointA).toBe("");
    expect(state.won).toEqual({ winnerShort: "N&J", scoreLine: "6-0", duration: "0:47" });
    expect(state.startedAt).toBe(STARTED);
  });

  it("is idle with no hint when there is no history", () => {
    const state = buildWatchState({ ownerId: "nico", now: NOW });

    expect(state.phase).toBe("idle");
    expect(state.last).toBeUndefined();
    expect(state.teamA).toEqual({ short: "", serving: false });
    expect(state.clock).toBe("");
  });

  it("shows the last match as a quick-start hint, from the owner's perspective", () => {
    const owedWin = baseMatch({
      status: "finished",
      winner: "A",
      scoreLine: "6-3 · 7-6",
      endedAt: NOW,
    });
    expect(buildWatchState({ ownerId: "nico", now: NOW, last: owedWin }).last).toEqual({
      line: "6-3 · 7-6 vs M&L",
      won: true,
    });

    const owedLoss = baseMatch({
      status: "finished",
      winner: "B",
      scoreLine: "4-6 · 6-7",
      endedAt: NOW,
    });
    expect(buildWatchState({ ownerId: "nico", now: NOW, last: owedLoss }).last).toEqual({
      line: "4-6 · 6-7 vs M&L",
      won: false,
    });
  });
});
