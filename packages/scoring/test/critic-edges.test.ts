import { describe, expect, it } from "vitest";
import type { MatchConfig } from "../src/index.ts";
import { statusLabel, watchStatusLabel } from "../src/index.ts";
import {
  ADVANTAGE_MATCH,
  gamesToSixAll,
  loveGame,
  loveSet,
  loveTieBreak,
  STAR_MATCH,
  SUPER_TB_MATCH,
  snap,
} from "./helpers.ts";

describe("serve handoff after a tie-break set (FIP tie-break pt 5)", () => {
  it("hands the next set to the pair that did not START the tie-break, even when they won it", () => {
    // Starter is A (rotation), but B wins the tie-break — the next set still
    // goes to other(starter) = B. This disambiguates starter vs winner vs loser.
    const snapshot = snap(ADVANTAGE_MATCH, `${gamesToSixAll()}${loveTieBreak("B")}`);
    expect(snapshot.setNumber).toBe(2);
    expect(snapshot.servingTeam).toBe("B");
  });

  it("routes the super tie-break server through a 7-6 first set", () => {
    // Set 1: tie-break set (starter A) -> set 2 starts with B.
    // Set 2: B loses 0-6 over games 13-18 (servers B,A,B,A,B,A).
    // Sets 1-1 -> super TB starts with the pair whose turn it is: B.
    const oneSetAllViaTieBreak = `${gamesToSixAll()}${loveTieBreak("A")}${loveSet("B")}`;
    const snapshot = snap(SUPER_TB_MATCH, oneSetAllViaTieBreak);
    expect(snapshot.currentGame).toMatchObject({ tieBreakKind: "superTieBreak" });
    expect(snapshot.servingTeam).toBe("B");
  });
});

describe("star point boundaries (FIP rule 1, option 2)", () => {
  it("stays plain deuce and advantage through deuce 1 and deuce 2", () => {
    expect(snap(STAR_MATCH, "AAABBB").moment).toEqual({ kind: "deuce" });
    expect(snap(STAR_MATCH, "AAABBBA").moment).toEqual({ kind: "advantage", team: "A" });
    expect(snap(STAR_MATCH, "AAABBBAB").moment).toEqual({ kind: "deuce" });
    expect(snap(STAR_MATCH, "AAABBBABB").moment).toEqual({ kind: "advantage", team: "B" });
  });

  it("shows 40-40 calls at deuce 2 and the star point", () => {
    const deuceTwo = snap(STAR_MATCH, "AAABBBAB").currentGame;
    expect(deuceTwo).toMatchObject({ calls: { A: "40", B: "40" } });
    const starPoint = snap(STAR_MATCH, "AAABBBABBA").currentGame;
    expect(starPoint).toMatchObject({ calls: { A: "40", B: "40" } });
  });

  it("labels the star point on phone and watch", () => {
    const { moment } = snap(STAR_MATCH, "AAABBBABBA");
    expect(moment).toEqual({ kind: "starPoint" });
    expect(statusLabel(moment, { A: "Nico & Javi", B: "Marta & Leo" })).toBe("STAR POINT");
    expect(watchStatusLabel(moment, { A: "N&J", B: "M&L" })).toBe("STAR PT");
  });
});

describe("advantage third set moments (no tie-break)", () => {
  const config: MatchConfig = { ...ADVANTAGE_MATCH, thirdSet: "advantageSet" };
  const oneSetAll = `${loveSet("A")}${loveSet("B")}`;

  it("keeps 6-6 40-0 a plain game point — no set at stake yet", () => {
    const snapshot = snap(config, `${oneSetAll}${gamesToSixAll()}AAA`);
    expect(snapshot.moment).toEqual({ kind: "gamePoint", team: "A" });
  });

  it("escalates to match point at 7-6 40-0", () => {
    const snapshot = snap(config, `${oneSetAll}${gamesToSixAll()}${loveGame("A")}AAA`);
    expect(snapshot.moment).toEqual({ kind: "matchPoint", team: "A" });
  });
});

describe("long deuce wars keep clean calls", () => {
  it("shows 40-40 and AD deep into a war", () => {
    const eightCycles = `AAABBB${"AB".repeat(8)}`;
    const level = snap(ADVANTAGE_MATCH, eightCycles);
    expect(level.currentGame).toMatchObject({ calls: { A: "40", B: "40" } });
    expect(level.moment).toEqual({ kind: "deuce" });

    const lead = snap(ADVANTAGE_MATCH, `${eightCycles}A`);
    expect(lead.currentGame).toMatchObject({ calls: { A: "AD", B: "40" } });
    expect(lead.moment).toEqual({ kind: "advantage", team: "A" });
  });
});
