import type { MatchConfig, MatchSnapshot, PointEvent, TeamId } from "../src/index.ts";
import { computeMatch } from "../src/index.ts";

export const ADVANTAGE_MATCH: MatchConfig = {
  bestOf: 3,
  deuceMode: "advantage",
  thirdSet: "fullSet",
  firstServe: "A",
};

export const GOLDEN_MATCH: MatchConfig = { ...ADVANTAGE_MATCH, deuceMode: "goldenPoint" };
export const STAR_MATCH: MatchConfig = { ...ADVANTAGE_MATCH, deuceMode: "starPoint" };
export const SUPER_TB_MATCH: MatchConfig = { ...ADVANTAGE_MATCH, thirdSet: "superTieBreak" };

/** Build events from a compact pattern like "AAAB BABA" (spaces ignored). */
export function points(pattern: string): PointEvent[] {
  const millisecondsPerPoint = 30_000;
  return [...pattern.replaceAll(/\s/gu, "")].map((letter, index) => {
    if (letter !== "A" && letter !== "B") {
      throw new Error(`bad pattern letter: ${letter}`);
    }
    return { winner: letter, at: index * millisecondsPerPoint };
  });
}

/** Four straight points — a love game in every deuce mode. */
export function loveGame(team: TeamId): string {
  return team.repeat(4);
}

/** Six love games — a 6-0 set from any game score. */
export function loveSet(team: TeamId): string {
  return loveGame(team).repeat(6);
}

/** A 7-point-to-zero tie-break. */
export function loveTieBreak(team: TeamId): string {
  return team.repeat(7);
}

/** Pattern reaching 6-6 in games from the start of a set (love games only). */
export function gamesToSixAll(): string {
  const alternating = `${loveGame("A")}${loveGame("B")}`;
  return alternating.repeat(6);
}

export function snap(config: MatchConfig, pattern: string): MatchSnapshot {
  return computeMatch(config, points(pattern));
}
