import type { Moment, TeamId, TeamValues } from "./types.ts";

/** The sports whose vocabulary the labels use (defaults to padel). */
export type LabelSport = "padel" | "squash" | "pickleball";

/**
 * Squash says "game ball" and "match ball"; padel and pickleball say "point".
 * Only the two decisive moments differ, so the strings are derived once.
 */
function decisiveLabels(sport: LabelSport): { game: string; match: string } {
  return sport === "squash"
    ? { game: "GAME BALL", match: "MATCH BALL" }
    : { game: "GAME POINT", match: "MATCH POINT" };
}

/**
 * Long status label for the phone's live pill, matching the design copy:
 * "GAME POINT — NICO & JAVI", "DEUCE", "ADVANTAGE — NICO & JAVI",
 * "TIE-BREAK — SET 2". Returns undefined mid-game when nothing is at stake.
 */
export function statusLabel(
  moment: Moment,
  teamNames: TeamValues<string>,
  sport: LabelSport = "padel",
): string | undefined {
  const name = (team: TeamId): string => teamNames[team].toUpperCase();
  const decisive = decisiveLabels(sport);
  switch (moment.kind) {
    case "normal":
      return;
    case "gamePoint":
      return `${decisive.game} — ${name(moment.team)}`;
    case "setPoint":
      return `SET POINT — ${name(moment.team)}`;
    case "matchPoint":
      return `${decisive.match} — ${name(moment.team)}`;
    case "deuce":
      return "DEUCE";
    case "advantage":
      return `ADVANTAGE — ${name(moment.team)}`;
    case "goldenPoint":
      return "GOLDEN POINT";
    case "starPoint":
      return "STAR POINT";
    case "setChoice":
      return "SET 1 OR 2?";
    case "tieBreak":
      return `TIE-BREAK — SET ${String(moment.setNumber)}`;
    case "superTieBreak":
      return "SUPER TIE-BREAK";
    case "finished":
      return "MATCH WON";
    default: {
      const unreachable: never = moment;
      throw new Error(`unknown moment: ${String(unreachable)}`);
    }
  }
}

/**
 * Short status label for watch-sized surfaces, matching the design copy:
 * "GAME PT", "DEUCE", "AD · N&J", "TIE-BREAK" (squash: "GAME BALL"/"MATCH BALL").
 */
export function watchStatusLabel(
  moment: Moment,
  shortNames: TeamValues<string>,
  sport: LabelSport = "padel",
): string | undefined {
  switch (moment.kind) {
    case "normal":
      return;
    case "gamePoint":
      return sport === "squash" ? "GAME BALL" : "GAME PT";
    case "setPoint":
      return "SET PT";
    case "matchPoint":
      return sport === "squash" ? "MATCH BALL" : "MATCH PT";
    case "deuce":
      return "DEUCE";
    case "advantage":
      return `AD · ${shortNames[moment.team].toUpperCase()}`;
    case "goldenPoint":
      return "GOLDEN PT";
    case "starPoint":
      return "STAR PT";
    case "setChoice":
      return "SET 1 OR 2";
    case "tieBreak":
      return "TIE-BREAK";
    case "superTieBreak":
      return "SUPER TB";
    case "finished":
      return "WON";
    default: {
      const unreachable: never = moment;
      throw new Error(`unknown moment: ${String(unreachable)}`);
    }
  }
}
