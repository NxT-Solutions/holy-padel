import { describe, expect, it } from "vitest";
import type { MatchConfig, TeamId } from "../src/index.ts";
import { tieBreakServer } from "../src/index.ts";
import {
  ADVANTAGE_MATCH,
  gamesToSixAll,
  loveGame,
  loveSet,
  loveTieBreak,
  points,
  snap,
} from "./helpers.ts";

describe("service rotation between games (FIP Rules 4 and 6.8)", () => {
  it("starts with the configured first server", () => {
    expect(snap(ADVANTAGE_MATCH, "").servingTeam).toBe("A");
    const bFirst: MatchConfig = { ...ADVANTAGE_MATCH, firstServe: "B" };
    expect(snap(bFirst, "").servingTeam).toBe("B");
  });

  it("alternates teams every game", () => {
    expect(snap(ADVANTAGE_MATCH, loveGame("A")).servingTeam).toBe("B");
    expect(snap(ADVANTAGE_MATCH, `${loveGame("A")}${loveGame("A")}`).servingTeam).toBe("A");
  });

  it("keeps alternating across a set boundary", () => {
    // A 6-0 set is six games; server of set 2 game 1 must be the team
    // that did not serve game 6 (alternation continues).
    const snapshot = snap(ADVANTAGE_MATCH, loveGame("A").repeat(6));
    expect(snapshot.setNumber).toBe(2);
    expect(snapshot.servingTeam).toBe("A");
  });
});

describe("tie-break serve pattern (FIP Rule 1, tie-break pt 3)", () => {
  it("follows 1 point, then 2 points per pair, alternating", () => {
    const expected: readonly TeamId[] = ["A", "B", "B", "A", "A", "B", "B", "A"];
    expected.forEach((team, pointIndex) => {
      expect(tieBreakServer("A", pointIndex)).toBe(team);
    });
  });

  it("exposes the rotation through the live snapshot", () => {
    const sixAll = gamesToSixAll();
    // Game 12 was served by B (alternation from A), so A starts the tie-break.
    expect(snap(ADVANTAGE_MATCH, sixAll).servingTeam).toBe("A");
    expect(snap(ADVANTAGE_MATCH, `${sixAll}A`).servingTeam).toBe("B");
    expect(snap(ADVANTAGE_MATCH, `${sixAll}AB`).servingTeam).toBe("B");
    expect(snap(ADVANTAGE_MATCH, `${sixAll}ABA`).servingTeam).toBe("A");
  });

  it("gives the first game of the next set to the pair that did not start the tie-break", () => {
    const snapshot = snap(ADVANTAGE_MATCH, `${gamesToSixAll()}${loveTieBreak("A")}`);
    expect(snapshot.setNumber).toBe(2);
    expect(snapshot.servingTeam).toBe("B");
  });

  it("hands the super tie-break to the pair whose turn it is", () => {
    const config: MatchConfig = { ...ADVANTAGE_MATCH, thirdSet: "superTieBreak" };
    // One set all in 12 games; servers alternate A, B, ... so the super TB starts with A.
    const oneSetAll = `${loveSet("A")}${loveSet("B")}`;
    const snapshot = snap(config, oneSetAll);
    expect(snapshot.currentGame).toMatchObject({ tieBreakKind: "superTieBreak" });
    expect(snapshot.servingTeam).toBe("A");
  });
});

describe("event validation", () => {
  it("rejects malformed patterns in the helper itself", () => {
    expect(() => points("AXB")).toThrow(/bad pattern/u);
  });
});
