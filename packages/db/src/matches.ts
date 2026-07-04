import type { MatchConfig, PointEvent, TeamId } from "@holy-padel/scoring";
import type { SqlDriver, SqlRow } from "./driver.ts";
import {
  expectNumber,
  expectString,
  inTransaction,
  optionalNumber,
  optionalString,
  queryOne,
} from "./driver.ts";

export type MatchStatus = "live" | "finished";

export interface TeamPlayers {
  readonly A: readonly [string, string];
  readonly B: readonly [string, string];
}

export interface NewMatch {
  readonly id: string;
  readonly config: MatchConfig;
  readonly players: TeamPlayers;
  readonly court?: string;
  readonly location?: string;
  readonly startedAt: number;
}

export interface StoredMatch {
  readonly id: string;
  readonly status: MatchStatus;
  readonly config: MatchConfig;
  readonly players: TeamPlayers;
  readonly court: string | undefined;
  readonly location: string | undefined;
  readonly startedAt: number;
  readonly endedAt: number | undefined;
  readonly winner: TeamId | undefined;
  readonly scoreLine: string | undefined;
}

/** A match row joined with the four player names, for list screens. */
export interface MatchSummary extends StoredMatch {
  readonly names: {
    readonly A: readonly [string, string];
    readonly B: readonly [string, string];
  };
}

function parseTeam(value: string): TeamId {
  if (value !== "A" && value !== "B") {
    throw new Error(`invalid team id: ${value}`);
  }
  return value;
}

const SINGLE_SET = 1;
const BEST_OF_THREE = 3;

function parseConfig(row: SqlRow): MatchConfig {
  const bestOf = expectNumber(row, "best_of");
  if (bestOf !== SINGLE_SET && bestOf !== BEST_OF_THREE) {
    throw new Error(`invalid best_of: ${String(bestOf)}`);
  }
  const deuceMode = expectString(row, "deuce_mode");
  if (deuceMode !== "advantage" && deuceMode !== "starPoint" && deuceMode !== "goldenPoint") {
    throw new Error(`invalid deuce_mode: ${deuceMode}`);
  }
  const thirdSet = expectString(row, "third_set");
  if (thirdSet !== "fullSet" && thirdSet !== "advantageSet" && thirdSet !== "superTieBreak") {
    throw new Error(`invalid third_set: ${thirdSet}`);
  }
  return { bestOf, deuceMode, thirdSet, firstServe: parseTeam(expectString(row, "first_serve")) };
}

function toStoredMatch(row: SqlRow): StoredMatch {
  const status = expectString(row, "status");
  if (status !== "live" && status !== "finished") {
    throw new Error(`invalid match status: ${status}`);
  }
  const winner = optionalString(row, "winner");
  return {
    id: expectString(row, "id"),
    status,
    config: parseConfig(row),
    players: {
      A: [expectString(row, "team_a_player_1"), expectString(row, "team_a_player_2")],
      B: [expectString(row, "team_b_player_1"), expectString(row, "team_b_player_2")],
    },
    court: optionalString(row, "court"),
    location: optionalString(row, "location"),
    startedAt: expectNumber(row, "started_at"),
    endedAt: optionalNumber(row, "ended_at"),
    winner: winner === undefined ? undefined : parseTeam(winner),
    scoreLine: optionalString(row, "score_line"),
  };
}

function toSummary(row: SqlRow): MatchSummary {
  return {
    ...toStoredMatch(row),
    names: {
      A: [expectString(row, "name_a_1"), expectString(row, "name_a_2")],
      B: [expectString(row, "name_b_1"), expectString(row, "name_b_2")],
    },
  };
}

const SUMMARY_SELECT = `
  SELECT m.*,
         pa1.name AS name_a_1, pa2.name AS name_a_2,
         pb1.name AS name_b_1, pb2.name AS name_b_2
  FROM matches m
  JOIN players pa1 ON pa1.id = m.team_a_player_1
  JOIN players pa2 ON pa2.id = m.team_a_player_2
  JOIN players pb1 ON pb1.id = m.team_b_player_1
  JOIN players pb2 ON pb2.id = m.team_b_player_2
`;

export function createMatch(driver: SqlDriver, match: NewMatch): void {
  const { config, players } = match;
  driver.execute(
    `INSERT INTO matches (
       id, status, best_of, deuce_mode, third_set, first_serve,
       team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2,
       court, location, started_at
     ) VALUES (?, 'live', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      match.id,
      config.bestOf,
      config.deuceMode,
      config.thirdSet,
      config.firstServe,
      players.A[0],
      players.A[1],
      players.B[0],
      players.B[1],
      match.court ?? null,
      match.location ?? null,
      match.startedAt,
    ],
  );
}

export function getMatch(driver: SqlDriver, id: string): MatchSummary | undefined {
  const row = queryOne(driver, `${SUMMARY_SELECT} WHERE m.id = ?`, [id]);
  return row === undefined ? undefined : toSummary(row);
}

/** The one live match, if any — the home screen's "resume scoring" card. */
export function getLiveMatch(driver: SqlDriver): MatchSummary | undefined {
  const row = queryOne(
    driver,
    `${SUMMARY_SELECT} WHERE m.status = 'live' ORDER BY m.started_at DESC LIMIT 1`,
  );
  return row === undefined ? undefined : toSummary(row);
}

export function listMatches(driver: SqlDriver): MatchSummary[] {
  return driver.queryAll(`${SUMMARY_SELECT} ORDER BY m.started_at DESC`).map(toSummary);
}

export function deleteMatch(driver: SqlDriver, id: string): void {
  inTransaction(driver, () => {
    driver.execute("DELETE FROM match_events WHERE match_id = ?", [id]);
    driver.execute("DELETE FROM matches WHERE id = ?", [id]);
  });
}

export function loadEvents(driver: SqlDriver, matchId: string): PointEvent[] {
  return driver
    .queryAll("SELECT winner, at FROM match_events WHERE match_id = ? ORDER BY seq", [matchId])
    .map((row) => ({
      winner: parseTeam(expectString(row, "winner")),
      at: expectNumber(row, "at"),
    }));
}

/**
 * Append one rally. A no-op unless the match exists and is still live —
 * a stray write after the final point must never poison the event log.
 */
export function appendEvent(driver: SqlDriver, matchId: string, event: PointEvent): void {
  driver.execute(
    `INSERT INTO match_events (match_id, seq, winner, at)
     SELECT ?, (SELECT COALESCE(MAX(seq), 0) + 1 FROM match_events WHERE match_id = ?), ?, ?
     WHERE EXISTS (SELECT 1 FROM matches WHERE id = ? AND status = 'live')`,
    [matchId, matchId, event.winner, event.at, matchId],
  );
}

const APPEND_CHUNK = 100;

/** Append many events in a few multi-row inserts (bulk seeding, imports). */
export function appendEvents(
  driver: SqlDriver,
  matchId: string,
  events: readonly PointEvent[],
): void {
  const row = queryOne(
    driver,
    "SELECT COALESCE(MAX(seq), 0) AS seq FROM match_events WHERE match_id = ?",
    [matchId],
  );
  const baseSeq = row === undefined ? 0 : expectNumber(row, "seq");
  for (let start = 0; start < events.length; start += APPEND_CHUNK) {
    const chunk = events.slice(start, start + APPEND_CHUNK);
    const placeholders = chunk.map(() => "(?, ?, ?, ?)").join(", ");
    const chunkBase = baseSeq + start;
    const params = chunk.flatMap((event, offset) => [
      matchId,
      chunkBase + offset + 1,
      event.winner,
      event.at,
    ]);
    driver.execute(
      `INSERT INTO match_events (match_id, seq, winner, at) VALUES ${placeholders}`,
      params,
    );
  }
}

export function removeLastEvent(driver: SqlDriver, matchId: string): void {
  driver.execute(
    `DELETE FROM match_events
     WHERE match_id = ? AND seq = (SELECT MAX(seq) FROM match_events WHERE match_id = ?)`,
    [matchId, matchId],
  );
}

/** Mark a live match as finished and cache its display score line. */
export function finishMatch(
  driver: SqlDriver,
  id: string,
  outcome: { readonly winner: TeamId; readonly endedAt: number; readonly scoreLine: string },
): void {
  driver.execute(
    "UPDATE matches SET status = 'finished', winner = ?, ended_at = ?, score_line = ? WHERE id = ?",
    [outcome.winner, outcome.endedAt, outcome.scoreLine, id],
  );
}

/** Reopen a finished match (undo pressed on the match-won screen). */
export function reopenMatch(driver: SqlDriver, id: string): void {
  driver.execute(
    "UPDATE matches SET status = 'live', winner = NULL, ended_at = NULL, score_line = NULL WHERE id = ?",
    [id],
  );
}

export function countMatches(driver: SqlDriver): number {
  const row = queryOne(driver, "SELECT COUNT(*) AS n FROM matches");
  return row === undefined ? 0 : expectNumber(row, "n");
}
