import type { Moment, TeamId, TeamValues } from "./types.ts";

/**
 * Long status label for the phone's live pill, matching the design copy:
 * "GAME POINT — NICO & JAVI", "DEUCE", "ADVANTAGE — NICO & JAVI",
 * "TIE-BREAK — SET 2". Returns undefined mid-game when nothing is at stake.
 */
export function statusLabel(moment: Moment, teamNames: TeamValues<string>): string | undefined {
  const name = (team: TeamId): string => teamNames[team].toUpperCase();
  switch (moment.kind) {
    case "normal":
      return;
    case "gamePoint":
      return `GAME POINT — ${name(moment.team)}`;
    case "setPoint":
      return `SET POINT — ${name(moment.team)}`;
    case "matchPoint":
      return `MATCH POINT — ${name(moment.team)}`;
    case "deuce":
      return "DEUCE";
    case "advantage":
      return `ADVANTAGE — ${name(moment.team)}`;
    case "goldenPoint":
      return "GOLDEN POINT";
    case "starPoint":
      return "STAR POINT";
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
 * "GAME PT", "DEUCE", "AD · N&J", "TIE-BREAK".
 */
export function watchStatusLabel(
  moment: Moment,
  shortNames: TeamValues<string>,
): string | undefined {
  switch (moment.kind) {
    case "normal":
      return;
    case "gamePoint":
      return "GAME PT";
    case "setPoint":
      return "SET PT";
    case "matchPoint":
      return "MATCH PT";
    case "deuce":
      return "DEUCE";
    case "advantage":
      return `AD · ${shortNames[moment.team].toUpperCase()}`;
    case "goldenPoint":
      return "GOLDEN PT";
    case "starPoint":
      return "STAR PT";
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
