import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { MatchConfig, MatchSnapshot, PointEvent, TeamId } from "../src/index.ts";
import { computeMatch, undoLastPoint } from "../src/index.ts";

const configArbitrary: fc.Arbitrary<MatchConfig> = fc.record({
  bestOf: fc.constantFrom<1 | 3>(1, 3),
  deuceMode: fc.constantFrom("advantage" as const, "starPoint" as const, "goldenPoint" as const),
  thirdSet: fc.constantFrom("fullSet" as const, "advantageSet" as const, "superTieBreak" as const),
  firstServe: fc.constantFrom<TeamId>("A", "B"),
});

const winnersArbitrary = fc.array(fc.constantFrom<TeamId>("A", "B"), {
  minLength: 0,
  maxLength: 500,
});

/** Apply winners until the match finishes; return the valid event prefix. */
function playableEvents(config: MatchConfig, winners: readonly TeamId[]): PointEvent[] {
  const events: PointEvent[] = [];
  for (const winner of winners) {
    if (computeMatch(config, events).finished) {
      break;
    }
    events.push({ winner, at: events.length * 1000 });
  }
  return events;
}

function validSetScore(snapshot: MatchSnapshot): boolean {
  return snapshot.completedSets.every((set) => {
    const winner = set.games[set.winner];
    const loser = set.winner === "A" ? set.games.B : set.games.A;
    if (set.kind === "superTieBreak") {
      return winner >= 10 && winner - loser >= 2;
    }
    if (set.tieBreak !== undefined) {
      const tieBreakWinner = set.tieBreak[set.winner];
      const tieBreakLoser = set.winner === "A" ? set.tieBreak.B : set.tieBreak.A;
      return (
        winner === 7 && loser === 6 && tieBreakWinner >= 7 && tieBreakWinner - tieBreakLoser >= 2
      );
    }
    // 6+ with two clear (advantage third sets may run past 7), or exactly 7-5.
    return (winner >= 6 && winner - loser >= 2) || (winner === 7 && loser === 5);
  });
}

describe("engine invariants over random matches", () => {
  it("keeps totals, set scores and finish state consistent", () => {
    fc.assert(
      fc.property(configArbitrary, winnersArbitrary, (config, winners) => {
        const events = playableEvents(config, winners);
        const snapshot = computeMatch(config, events);

        // Every rally is counted exactly once.
        const pointsA = events.filter((event) => event.winner === "A").length;
        expect(snapshot.totalPoints.A).toBe(pointsA);
        expect(snapshot.totalPoints.B).toBe(events.length - pointsA);

        // Set scores always satisfy the FIP shapes.
        expect(validSetScore(snapshot)).toBe(true);

        // Finished ⇔ someone owns enough sets; winner set exactly then.
        const setsToWin = config.bestOf === 1 ? 1 : 2;
        const setsA = snapshot.completedSets.filter((set) => set.winner === "A").length;
        const setsB = snapshot.completedSets.length - setsA;
        expect(snapshot.finished).toBe(setsA === setsToWin || setsB === setsToWin);
        expect(snapshot.winner !== undefined).toBe(snapshot.finished);
        expect(snapshot.currentGame === undefined).toBe(snapshot.finished);
      }),
      { numRuns: 300 },
    );
  });

  it("undo always restores the previous snapshot exactly", () => {
    fc.assert(
      fc.property(configArbitrary, winnersArbitrary, (config, winners) => {
        const events = playableEvents(config, winners);
        if (events.length === 0) {
          return;
        }
        const before = computeMatch(config, events.slice(0, -1));
        const after = computeMatch(config, [...undoLastPoint(events)]);
        expect(after).toEqual(before);
      }),
      { numRuns: 200 },
    );
  });

  it("refuses points after the match is over", () => {
    fc.assert(
      fc.property(configArbitrary, winnersArbitrary, (config, winners) => {
        const events = playableEvents(config, winners);
        const snapshot = computeMatch(config, events);
        if (!snapshot.finished) {
          return;
        }
        expect(() => computeMatch(config, [...events, { winner: "A", at: 999_999_999 }])).toThrow(
          /finished/u,
        );
      }),
      { numRuns: 100 },
    );
  });

  it("alternates the serving pair on every standard game", () => {
    fc.assert(
      fc.property(configArbitrary, winnersArbitrary, (config, winners) => {
        const events = playableEvents(config, winners);
        const gameServers = new Map<number, TeamId>();
        for (let index = 0; index <= events.length; index += 1) {
          const snapshot = computeMatch(config, events.slice(0, index));
          if (!snapshot.finished && snapshot.currentGame?.kind === "standard") {
            const games = snapshot.totalGames.A + snapshot.totalGames.B;
            gameServers.set(games, snapshot.servingTeam);
          }
        }
        for (const [games, server] of gameServers) {
          const previous = gameServers.get(games - 1);
          if (previous !== undefined) {
            expect(server).not.toBe(previous);
          }
        }
      }),
      { numRuns: 60 },
    );
  });
});
