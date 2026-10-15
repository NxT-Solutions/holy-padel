import type { MatchSummary } from "@holy-padel/db";
import { opponentsOf, ownerTeamOf, pairLabel } from "@/lib/format.ts";

/** One distinct opposing side from the owner's recent matches. */
export interface RecentOpponent {
  /** The opponent ids, order-independent — dedupes "Marta & Leo" with "Leo & Marta". */
  readonly key: string;
  /** The ids to hand back as Team B, in the order the match stored them. */
  readonly playerIds: readonly string[];
  /** "Marta" (singles) or "Marta & Leo" (doubles). */
  readonly label: string;
}

/** The opposing side of one match, or undefined when its format doesn't match. */
function sideOf(
  match: MatchSummary,
  ownerId: string,
  format: "singles" | "doubles",
): RecentOpponent | undefined {
  const ownerTeam = ownerTeamOf(match, ownerId);
  const ids = ownerTeam === "A" ? match.players.B : match.players.A;
  if ((ids[1] !== undefined) !== (format === "doubles")) {
    return;
  }
  const [first, second] = ids;
  const key = [...ids].sort().join("+");
  if (first === undefined || key === "") {
    return;
  }
  return {
    key,
    playerIds: second === undefined ? [first] : [first, second],
    label: pairLabel(opponentsOf(match, ownerTeam)),
  };
}

/**
 * The owner's most recent distinct opponents for one format, newest first and
 * capped at `limit`. Doubles pairs dedupe as an unordered pair, so a rematch
 * with the sides swapped is still the same rivals; singles dedupes by player.
 */
export function recentOpponents(
  matches: readonly MatchSummary[],
  ownerId: string,
  format: "singles" | "doubles",
  limit = 4,
): RecentOpponent[] {
  const seen = new Set<string>();
  const result: RecentOpponent[] = [];
  for (const match of matches) {
    const entry = sideOf(match, ownerId, format);
    if (entry !== undefined && !seen.has(entry.key)) {
      seen.add(entry.key);
      result.push(entry);
      if (result.length >= limit) {
        break;
      }
    }
  }
  return result;
}
