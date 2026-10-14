import { describe, expect, it } from "vitest";
import type { MatchConfig } from "../src/index.ts";
import { computeMatch, computeStats } from "../src/index.ts";
import { ADVANTAGE_MATCH, gamesToSixAll, loveGame, points } from "./helpers.ts";

describe("match statistics", () => {
  it("tracks totals, breaks and service games held", () => {
    // Set 1: A wins 6-0. Servers alternate A,B,A,B,A,B — so A breaks B three
    // times (games 2, 4, 6) and holds three times (games 1, 3, 5).
    const events = points(loveGame("A").repeat(6));
    const stats = computeStats(ADVANTAGE_MATCH, events);

    expect(stats.totalPoints).toEqual({ A: 24, B: 0 });
    expect(stats.breaks).toEqual({ A: 3, B: 0 });
    expect(stats.service.A).toEqual({ held: 3, served: 3 });
    expect(stats.service.B).toEqual({ held: 0, served: 3 });
    expect(stats.games).toHaveLength(6);
  });

  it("finds the longest game and reports break games per set", () => {
    // Game 1: love hold (4 points). Game 2: a long deuce battle won by A —
    // a break of B, 10 points in total.
    const longGame = "AAABBBABAA";
    const events = points(`${loveGame("A")}${longGame}${loveGame("A").repeat(4)}`);
    const stats = computeStats(ADVANTAGE_MATCH, events);

    expect(stats.longestGame).toMatchObject({
      setNumber: 1,
      gameNumber: 2,
      points: { A: 6, B: 4 },
    });
    const [firstSet] = stats.sets;
    expect(firstSet?.summary.games).toEqual({ A: 6, B: 0 });
    expect(firstSet?.breakGames).toEqual([
      { gameNumber: 2, team: "A" },
      { gameNumber: 4, team: "A" },
      { gameNumber: 6, team: "A" },
    ]);
  });

  it("excludes tie-breaks from service stats and keeps their kind", () => {
    const events = points(`${gamesToSixAll()}${"A".repeat(7)}`);
    const stats = computeStats(ADVANTAGE_MATCH, events);

    const tieBreak = stats.games.at(-1);
    expect(tieBreak).toMatchObject({ kind: "tieBreak", winner: "A" });
    // 12 standard games, 6 served each; every game was a love hold.
    expect(stats.service.A).toEqual({ held: 6, served: 6 });
    expect(stats.service.B).toEqual({ held: 6, served: 6 });
    expect(stats.breaks).toEqual({ A: 0, B: 0 });
  });

  it("measures durations from event timestamps", () => {
    const events = points(loveGame("A").repeat(6));
    const stats = computeStats(ADVANTAGE_MATCH, events);
    const [first] = events;
    const last = events.at(-1);
    expect(first).toBeDefined();
    expect(last).toBeDefined();
    if (first !== undefined && last !== undefined) {
      expect(stats.durationMs).toBe(last.at - first.at);
    }
    expect(stats.sets[0]?.durationMs).toBe(stats.durationMs);
  });

  it("tracks the longest run of consecutive rallies", () => {
    // A 3, B 4, A 2 — the squash headline run is B's four straight rallies.
    const stats = computeStats(ADVANTAGE_MATCH, points("AAABBBBAA"));
    expect(stats.longestRun).toEqual({ team: "B", count: 4 });
  });

  it("counts HI-HO hand-outs toward a run without scoring them", () => {
    const config: MatchConfig = {
      sport: "squash",
      bestOf: 1,
      deuceMode: "advantage",
      thirdSet: "fullSet",
      squashMode: "hiho",
      squashTarget: 11,
      squashTiebreak: "winByTwo",
      firstServe: "A",
    };
    // A serves and loses the opener (hand-out), B then wins four more, A one.
    const events = points("BBBBBA");
    const stats = computeStats(config, events);
    expect(stats.longestRun).toEqual({ team: "B", count: 5 });
    // HI-HO: only the server scores, so the game stands at 4-0 to B even
    // though every rally counts toward the run.
    expect(computeMatch(config, events).currentGame).toMatchObject({
      kind: "squash",
      points: { A: 0, B: 4 },
    });
  });
});
