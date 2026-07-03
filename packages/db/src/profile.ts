import type { TeamId } from "@holy-padel/scoring";
import type { SqlDriver } from "./driver.ts";
import type { MatchSummary } from "./matches.ts";
import { listMatches } from "./matches.ts";

export interface WinLoss {
  readonly won: number;
  readonly lost: number;
}

export interface PartnerRecord extends WinLoss {
  readonly playerId: string;
  readonly name: string;
}

export interface HeadToHeadRecord extends WinLoss {
  /** Opponent pair label, e.g. "Marta & Leo" (names sorted by first appearance). */
  readonly label: string;
}

export interface ProfileStats {
  readonly played: number;
  readonly record: WinLoss;
  /** 0-100, rounded — the design shows "67%". */
  readonly winRatePercent: number;
  /** Most recent finished matches first: true = won. */
  readonly form: readonly boolean[];
  readonly partners: readonly PartnerRecord[];
  readonly headToHead: readonly HeadToHeadRecord[];
}

const FORM_LENGTH = 5;
const PERCENT = 100;

function ownerTeamOf(match: MatchSummary, ownerId: string): TeamId | undefined {
  if (match.players.A.includes(ownerId)) {
    return "A";
  }
  return match.players.B.includes(ownerId) ? "B" : undefined;
}

interface OwnedResult {
  readonly match: MatchSummary;
  readonly ownerTeam: TeamId;
  readonly won: boolean;
}

function finishedResults(matches: readonly MatchSummary[], ownerId: string): OwnedResult[] {
  const results: OwnedResult[] = [];
  for (const match of matches) {
    const ownerTeam = ownerTeamOf(match, ownerId);
    if (match.status === "finished" && ownerTeam !== undefined && match.winner !== undefined) {
      results.push({ match, ownerTeam, won: match.winner === ownerTeam });
    }
  }
  return results;
}

function partnerRecords(results: readonly OwnedResult[], ownerId: string): PartnerRecord[] {
  const byPartner = new Map<string, { name: string; won: number; lost: number }>();
  for (const { match, ownerTeam, won } of results) {
    const ids = match.players[ownerTeam];
    const names = match.names[ownerTeam];
    const partnerIndex = ids[0] === ownerId ? 1 : 0;
    const partnerId = ids[partnerIndex];
    const partnerName = names[partnerIndex];
    if (partnerId !== undefined && partnerName !== undefined) {
      const entry = byPartner.get(partnerId) ?? { name: partnerName, won: 0, lost: 0 };
      if (won) {
        entry.won += 1;
      } else {
        entry.lost += 1;
      }
      byPartner.set(partnerId, entry);
    }
  }
  return [...byPartner.entries()]
    .map(([playerId, entry]) => ({
      playerId,
      name: entry.name,
      won: entry.won,
      lost: entry.lost,
    }))
    .sort((left, right) => right.won + right.lost - (left.won + left.lost));
}

function headToHeadRecords(results: readonly OwnedResult[]): HeadToHeadRecord[] {
  const byOpponents = new Map<string, { label: string; won: number; lost: number }>();
  for (const { match, ownerTeam, won } of results) {
    const opponentTeam: TeamId = ownerTeam === "A" ? "B" : "A";
    const names = match.names[opponentTeam];
    const key = [...match.players[opponentTeam]].sort().join("+");
    const entry = byOpponents.get(key) ?? { label: names.join(" & "), won: 0, lost: 0 };
    if (won) {
      entry.won += 1;
    } else {
      entry.lost += 1;
    }
    byOpponents.set(key, entry);
  }
  return [...byOpponents.values()]
    .map((entry) => ({ label: entry.label, won: entry.won, lost: entry.lost }))
    .sort((left, right) => right.won + right.lost - (left.won + left.lost));
}

/**
 * Everything the profile tab shows, computed from the local match database
 * ("records computed from local match DB" in the design).
 */
export function computeProfileStats(driver: SqlDriver, ownerId: string): ProfileStats {
  const results = finishedResults(listMatches(driver), ownerId);
  const won = results.filter((result) => result.won).length;
  const lost = results.length - won;
  const byRecency = [...results].sort(
    (left, right) => (right.match.endedAt ?? 0) - (left.match.endedAt ?? 0),
  );
  return {
    played: results.length,
    record: { won, lost },
    winRatePercent: results.length === 0 ? 0 : Math.round((won / results.length) * PERCENT),
    form: byRecency.slice(0, FORM_LENGTH).map((result) => result.won),
    partners: partnerRecords(results, ownerId),
    headToHead: headToHeadRecords(results),
  };
}
