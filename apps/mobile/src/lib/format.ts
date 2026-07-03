import type { MatchSummary } from "@holy-padel/db";
import type { MatchSnapshot, TeamId, TeamValues } from "@holy-padel/scoring";

const DAY_MS = 86_400_000;
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const;

/** "Nico & Javi" */
export function pairLabel(names: readonly [string, string]): string {
  return `${names[0]} & ${names[1]}`;
}

/** "N&J" */
export function pairInitials(names: readonly [string, string]): string {
  return `${names[0].charAt(0).toUpperCase()}&${names[1].charAt(0).toUpperCase()}`;
}

export function teamNames(match: MatchSummary): TeamValues<string> {
  return { A: pairLabel(match.names.A), B: pairLabel(match.names.B) };
}

export function teamInitials(match: MatchSummary): TeamValues<string> {
  return { A: pairInitials(match.names.A), B: pairInitials(match.names.B) };
}

/** The pair facing the owner's team. */
export function opponentsOf(match: MatchSummary, ownerTeam: TeamId): readonly [string, string] {
  return ownerTeam === "A" ? match.names.B : match.names.A;
}

export function ownerTeamOf(match: MatchSummary, ownerId: string): TeamId {
  return match.players.B.includes(ownerId) ? "B" : "A";
}

/** "TODAY", "TUE", or "JUN 24" — the design's match-row date style. */
export function dayLabel(timestamp: number, now: number): string {
  const date = new Date(timestamp);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  if (timestamp >= startOfToday.getTime()) {
    return "TODAY";
  }
  const daysAgo = Math.ceil((startOfToday.getTime() - timestamp) / DAY_MS);
  if (daysAgo <= 6) {
    return WEEKDAYS[date.getDay()] ?? "";
  }
  return `${MONTHS[date.getMonth()] ?? ""} ${String(date.getDate())}`;
}

/** "TUE JUN 30" — the overview header's date style. */
export function fullDayLabel(timestamp: number): string {
  const date = new Date(timestamp);
  const weekday = WEEKDAYS[date.getDay()] ?? "";
  const month = MONTHS[date.getMonth()] ?? "";
  return `${weekday} ${month} ${String(date.getDate())}`;
}

/** "18:32" */
export function timeLabel(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = String(date.getHours());
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/** "1:23" — match clock, hours:minutes. */
export function durationLabel(durationMs: number): string {
  const totalMinutes = Math.max(0, Math.round(durationMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${String(hours)}:${minutes}`;
}

/** "TODAY · 18:32 · COURT 4" or "TUE · CLUB PADEL NORTE". */
export function matchMetaLabel(match: MatchSummary, now: number): string {
  const day = dayLabel(match.startedAt, now);
  const place = match.court ?? match.location;
  const parts =
    day === "TODAY"
      ? [day, timeLabel(match.startedAt), match.court ?? match.location]
      : [day, place];
  return parts
    .filter((part): part is string => part !== undefined)
    .map((part) => part.toUpperCase())
    .join(" · ");
}

/** "6-4 · 4-3" — completed sets plus the set in play. */
export function liveScoreLine(snapshot: MatchSnapshot): string {
  const parts = snapshot.completedSets.map(
    (set) => `${String(set.games.A)}-${String(set.games.B)}`,
  );
  if (!snapshot.finished) {
    parts.push(`${String(snapshot.currentSetGames.A)}-${String(snapshot.currentSetGames.B)}`);
  }
  return parts.join(" · ");
}

/** "6-3 · 7-6" for a finished match, from the snapshot. */
export function finalScoreLine(snapshot: MatchSnapshot): string {
  return snapshot.completedSets
    .map((set) => `${String(set.games.A)}-${String(set.games.B)}`)
    .join(" · ");
}

/** "1.2 MB" */
export function megabytesLabel(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes.toFixed(1)} MB`;
}
