import type { MatchConfig, PointEvent, TeamId } from "@holy-padel/scoring";
import { describe, expect, it } from "vitest";
import { addClutch, EMPTY_CLUTCH, matchClutch, matchTurnarounds, percentOf } from "@/lib/clutch.ts";

const golden: MatchConfig = {
  bestOf: 1,
  deuceMode: "goldenPoint",
  thirdSet: "fullSet",
  firstServe: "A",
};

function rallies(winners: string): PointEvent[] {
  return [...winners].map((winner, index) => ({
    winner: (winner === "A" ? "A" : "B") satisfies TeamId,
    at: index * 1000,
  }));
}

describe("matchClutch", () => {
  it("counts a held love game as one game point closed out and no break points", () => {
    const clutch = matchClutch(golden, rallies("AAAA"), "A");

    expect(clutch.points).toEqual({ won: 4, of: 4 });
    expect(clutch.closing).toEqual({ won: 1, of: 1 });
    expect(clutch.saving).toEqual({ won: 0, of: 0 });
    expect(clutch.breakPoints).toEqual({ won: 0, of: 0 });
    expect(clutch.serveSaves).toEqual({ won: 0, of: 0 });
  });

  it("scores a golden point as deciding, a break point won for the receiver and one lost on serve", () => {
    const events = rallies("AAABBBB");
    const receiver = matchClutch(golden, events, "B");
    const server = matchClutch(golden, events, "A");

    expect(receiver.deciding).toEqual({ won: 1, of: 1 });
    expect(receiver.breakPoints).toEqual({ won: 1, of: 1 });
    // Saved 40-0, 40-15 and 40-30, then took the golden point (both a save and a close).
    expect(receiver.saving).toEqual({ won: 4, of: 4 });
    expect(receiver.closing).toEqual({ won: 1, of: 1 });
    expect(server.closing).toEqual({ won: 0, of: 4 });
    expect(server.saving).toEqual({ won: 0, of: 1 });
    expect(server.deciding).toEqual({ won: 0, of: 1 });
    expect(server.serveSaves).toEqual({ won: 0, of: 1 });
    expect(server.breakPoints).toEqual({ won: 0, of: 0 });
  });

  it("counts break points saved on serve, including the golden point", () => {
    // 0-40 down on serve, A wins four straight: three break points saved, then the golden point.
    const server = matchClutch(golden, rallies("BBBAAAA"), "A");

    expect(server.serveSaves).toEqual({ won: 4, of: 4 });
    expect(server.deciding).toEqual({ won: 1, of: 1 });
    expect(matchClutch(golden, rallies("BBBAAAA"), "B").breakPoints).toEqual({ won: 0, of: 4 });
  });

  it("adds records and rounds percentages", () => {
    const total = addClutch(
      matchClutch(golden, rallies("AAAA"), "A"),
      matchClutch(golden, rallies("AAABBBB"), "A"),
    );

    expect(total.points).toEqual({ won: 7, of: 11 });
    expect(percentOf(total.points)).toBe(64);
    expect(percentOf(EMPTY_CLUTCH.tieBreaks)).toBeUndefined();
  });
});

describe("matchTurnarounds", () => {
  // B takes four love games, then A wins six straight: 6-4 from 0-4.
  const events = rallies(`${"B".repeat(16)}${"A".repeat(24)}`);

  it("credits the comeback with the score at the widest gap", () => {
    expect(matchTurnarounds(golden, events, "A")).toEqual([
      { setNumber: 1, cameBack: true, at: { own: 0, other: 4 } },
    ]);
  });

  it("records the slipped lead from the other side", () => {
    expect(matchTurnarounds(golden, events, "B")).toEqual([
      { setNumber: 1, cameBack: false, at: { own: 4, other: 0 } },
    ]);
  });

  it("ignores a set that was never in doubt", () => {
    expect(matchTurnarounds(golden, rallies("A".repeat(24)), "A")).toEqual([]);
  });
});
