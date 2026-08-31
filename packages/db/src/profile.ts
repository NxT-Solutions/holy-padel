import type { TeamId } from "@holy-padel/scoring";
import { computeMatch } from "@holy-padel/scoring";
import type { SqlDriver } from "./driver.ts";
import type { MatchSummary } from "./match-types.ts";
import { listMatches, loadEvents } from "./matches.ts";

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

/** "Marta & Leo" — duplicated singles slots collapse to one name. */
function pairText(names: readonly (string | undefined)[]): string {
  const seen: string[] = [];
  for (const name of names) {
    if (name !== undefined && !seen.includes(name)) {
      seen.push(name);
    }
  }
  return seen.join(" & ");
}

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
    // Singles rows store the same player in both slots — nobody partnered you.
    if (partnerId !== undefined && partnerName !== undefined && partnerId !== ownerId) {
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
    const label = pairText(match.names[opponentTeam]);
    const key = [...match.players[opponentTeam]]
      .filter((p): p is string => p !== undefined)
      .sort()
      .join("+");
    const entry = byOpponents.get(key) ?? { label, won: 0, lost: 0 };
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

/** Points scored by the owner's teams and by their opponents. */
export interface PointsTotals {
  readonly for: number;
  readonly against: number;
}

export interface LifetimePoints extends PointsTotals {
  readonly bySport: {
    readonly padel: PointsTotals;
    readonly squash: PointsTotals;
    readonly pickleball: PointsTotals;
  };
}

const EMPTY_SPORT: () => { for: number; against: number } = () => ({ for: 0, against: 0 });

/**
 * Lifetime points scored for and against the owner across every finished
 * match, overall and per sport — replayed from the event ledgers.
 */
export function computePointsTotals(driver: SqlDriver, ownerId: string): LifetimePoints {
  const padel = EMPTY_SPORT();
  const squash = EMPTY_SPORT();
  const pickleball = EMPTY_SPORT();
  let forTotal = 0;
  let againstTotal = 0;
  const bySport: Record<"padel" | "squash" | "pickleball", { for: number; against: number }> = {
    padel,
    squash,
    pickleball,
  };
  for (const match of listMatches(driver)) {
    if (match.status !== "finished" || match.winner === undefined) {
      continue;
    }
    const ownerTeam = ownerTeamOf(match, ownerId);
    if (ownerTeam === undefined) {
      continue;
    }
    const { totalPoints } = computeMatch(match.config, loadEvents(driver, match.id));
    const scored: PointsTotals = {
      for: totalPoints[ownerTeam],
      against: totalPoints[ownerTeam === "A" ? "B" : "A"],
    };
    forTotal += scored.for;
    againstTotal += scored.against;
    const sport = bySport[match.config.sport ?? "padel"];
    sport.for += scored.for;
    sport.against += scored.against;
  }
  return { for: forTotal, against: againstTotal, bySport };
}
