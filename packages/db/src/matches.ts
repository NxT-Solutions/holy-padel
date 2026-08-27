import type { MatchConfig, PointEvent, TeamId } from "@holy-padel/scoring";
import { computeMatch } from "@holy-padel/scoring";
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
  readonly A: readonly [string, string | undefined];
  readonly B: readonly [string, string | undefined];
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
  /** Accumulated paused time (ms), excluded from the match duration. */
  readonly pausedMs: number;
  /** Start of the current pause (ms), or undefined while the match is running. */
  readonly pausedAt: number | undefined;
}

/** A match row joined with the four player names, for list screens. */
export interface MatchSummary extends StoredMatch {
  readonly names: {
    readonly A: readonly [string, string | undefined];
    readonly B: readonly [string, string | undefined];
  };
}

function parseTeam(value: string): TeamId {
  if (value !== "A" && value !== "B") {
    throw new Error(`invalid team id: ${value}`);
  }
  return value;
}



function parseConfig(row: SqlRow): MatchConfig {
  const sport = optionalString(row, "sport") ?? "padel";

  if (sport === "pickleball") {
    return {
      sport: "pickleball",
      bestOf: expectNumber(row, "pb_best_of") as 1 | 3 | 5,
      deuceMode: "advantage",
      thirdSet: "superTieBreak",
      firstServe: parseTeam(expectString(row, "first_serve")),
      firstServePending: expectNumber(row, "first_serve_pending") === 1,
      firstServeOriginallyUndecided: expectNumber(row, "first_serve_originally_undecided") === 1,
      pbType: (optionalString(row, "pb_type") as "singles" | "doubles" | undefined) ?? "doubles",
      pbTarget: optionalNumber(row, "pb_target") ?? 11,
      pbTiebreak: (optionalString(row, "pb_tiebreak") as "winByTwo" | "winByOne" | undefined) ?? "winByTwo",
    };
  }

  if (sport === "squash") {
    return {
      sport: "squash",
      bestOf: expectNumber(row, "squash_best_of") as 1 | 3 | 5,
      deuceMode: "advantage",
      thirdSet: "fullSet",
      firstServe: parseTeam(expectString(row, "first_serve")),
      firstServePending: expectNumber(row, "first_serve_pending") === 1,
      firstServeOriginallyUndecided: expectNumber(row, "first_serve_originally_undecided") === 1,
      squashMode: (optionalString(row, "squash_mode") as "par" | "hiho" | undefined) ?? "par",
      squashTarget: optionalNumber(row, "squash_target") ?? 11,
      squashTiebreak: (optionalString(row, "squash_tiebreak") as "winByTwo" | "setOne" | "setTwo" | undefined) ?? "winByTwo",
    };
  }

  const rawBestOf = expectNumber(row, "best_of");
  const padelBestOf = optionalNumber(row, "padel_best_of");
  const bestOf = padelBestOf ?? rawBestOf;
  if (bestOf !== 1 && bestOf !== 3 && bestOf !== 5) {
    throw new Error(`invalid best_of for padel: ${String(bestOf)}`);
  }

  const deuceMode = expectString(row, "deuce_mode");
  if (deuceMode !== "advantage" && deuceMode !== "starPoint" && deuceMode !== "goldenPoint") {
    throw new Error(`invalid deuce_mode: ${deuceMode}`);
  }
  const thirdSet = expectString(row, "third_set");
  if (thirdSet !== "fullSet" && thirdSet !== "advantageSet" && thirdSet !== "superTieBreak") {
    throw new Error(`invalid third_set: ${thirdSet}`);
  }

  return {
    sport: "padel",
    bestOf: bestOf as 1 | 3 | 5,
    deuceMode,
    thirdSet,
    firstServe: parseTeam(expectString(row, "first_serve")),
    firstServePending: expectNumber(row, "first_serve_pending") === 1,
    firstServeOriginallyUndecided: expectNumber(row, "first_serve_originally_undecided") === 1,
  };
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
      A: [expectString(row, "team_a_player_1"), optionalString(row, "team_a_player_2")],
      B: [expectString(row, "team_b_player_1"), optionalString(row, "team_b_player_2")],
    },
    court: optionalString(row, "court"),
    location: optionalString(row, "location"),
    startedAt: expectNumber(row, "started_at"),
    endedAt: optionalNumber(row, "ended_at"),
    winner: winner === undefined ? undefined : parseTeam(winner),
    scoreLine: optionalString(row, "score_line"),
    pausedMs: expectNumber(row, "paused_ms"),
    pausedAt: optionalNumber(row, "paused_at"),
  };
}

function toSummary(row: SqlRow): MatchSummary {
  return {
    ...toStoredMatch(row),
    names: {
      A: [expectString(row, "name_a_1"), optionalString(row, "name_a_2")],
      B: [expectString(row, "name_b_1"), optionalString(row, "name_b_2")],
    },
  };
}

const SUMMARY_SELECT = `
  SELECT m.*,
         pa1.name AS name_a_1, pa2.name AS name_a_2,
         pb1.name AS name_b_1, pb2.name AS name_b_2
  FROM matches m
  JOIN players pa1 ON pa1.id = m.team_a_player_1
  LEFT JOIN players pa2 ON pa2.id = m.team_a_player_2
  JOIN players pb1 ON pb1.id = m.team_b_player_1
  LEFT JOIN players pb2 ON pb2.id = m.team_b_player_2
`;

export function createMatch(driver: SqlDriver, match: NewMatch): void {
  const { config, players } = match;

  if (config.sport === "pickleball") {
    driver.execute(
      `INSERT INTO matches (
         id, status, sport, best_of, deuce_mode, third_set, first_serve, first_serve_pending, first_serve_originally_undecided,
         pb_type, pb_target, pb_tiebreak, pb_best_of,
         team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2,
         court, location, started_at
       ) VALUES (?, 'live', ?, ?, 'advantage', 'superTieBreak', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        match.id,
        "pickleball",
        config.bestOf,
        config.firstServePending ? "A" : config.firstServe,
        config.firstServePending ? 1 : 0,
        config.firstServeOriginallyUndecided ? 1 : 0,
        config.pbType,
        config.pbTarget,
        config.pbTiebreak,
        config.bestOf,
        players.A[0],
        players.A[1] ?? null,
        players.B[0],
        players.B[1] ?? null,
        match.court ?? null,
        match.location ?? null,
        match.startedAt,
      ],
    );
    return;
  }

  if (config.sport === "squash") {
    driver.execute(
      `INSERT INTO matches (
         id, status, sport, best_of, deuce_mode, third_set, first_serve, first_serve_pending, first_serve_originally_undecided,
         squash_mode, squash_target, squash_tiebreak, squash_best_of, padel_best_of,
         team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2,
         court, location, started_at
       ) VALUES (?, 'live', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        match.id,
        "squash",
        config.bestOf === 5 ? 1 : config.bestOf, // dummy padel value
        "advantage",
        "fullSet",
        config.firstServePending ? "A" : config.firstServe,
        config.firstServePending ? 1 : 0,
        config.firstServeOriginallyUndecided ? 1 : 0,
        config.squashMode,
        config.squashTarget,
        config.squashTiebreak,
        config.bestOf,
        null, // padel_best_of
        players.A[0],
        players.A[1] ?? null,
        players.B[0],
        players.B[1] ?? null,
        match.court ?? null,
        match.location ?? null,
        match.startedAt,
      ],
    );
    return;
  }

  driver.execute(
    `INSERT INTO matches (
       id, status, sport, best_of, deuce_mode, third_set, first_serve, first_serve_pending, first_serve_originally_undecided,
       padel_best_of,
       team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2,
       court, location, started_at
     ) VALUES (?, 'live', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      match.id,
      "padel",
      config.bestOf,
      config.deuceMode,
      config.thirdSet,
      config.firstServePending ? "A" : config.firstServe,
      config.firstServePending ? 1 : 0,
      config.firstServeOriginallyUndecided ? 1 : 0,
      config.bestOf,
      players.A[0],
      players.A[1] ?? null,
      players.B[0],
      players.B[1] ?? null,
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

export function updateFirstServe(driver: SqlDriver, id: string, team: TeamId): void {
  driver.execute("UPDATE matches SET first_serve = ?, first_serve_pending = 0 WHERE id = ?", [
    team,
    id,
  ]);
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

/**
 * Score a rally — the guarded entry point for every "+1" from the phone or a
 * watch. Reads the committed state fresh and refuses the point when the match
 * isn't live, is paused, or the engine already considers it decided. Because
 * each call re-reads, a burst of fast taps (e.g. mashing the watch) can't append
 * events past match point — the second tap sees the finished fold and stops.
 */
export function scorePoint(driver: SqlDriver, matchId: string, winner: TeamId, at: number): void {
  const match = getMatch(driver, matchId);
  if (match === undefined || match.status !== "live" || match.pausedAt !== undefined) {
    return;
  }
  if (computeMatch(match.config, loadEvents(driver, matchId)).finished) {
    return;
  }
  appendEvent(driver, matchId, { winner, at });
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
  // Close any open pause at the end time so the stored paused_ms is final.
  driver.execute(
    `UPDATE matches
       SET status = 'finished', winner = ?, ended_at = ?, score_line = ?,
           paused_ms = paused_ms + CASE WHEN paused_at IS NULL THEN 0 ELSE ? - paused_at END,
           paused_at = NULL
     WHERE id = ?`,
    [outcome.winner, outcome.endedAt, outcome.scoreLine, outcome.endedAt, id],
  );
}

/** Pause a live match — records the pause start; a no-op if already paused. */
export function pauseMatch(driver: SqlDriver, id: string, now: number): void {
  driver.execute(
    "UPDATE matches SET paused_at = ? WHERE id = ? AND status = 'live' AND paused_at IS NULL",
    [now, id],
  );
}

/** Resume a paused match — banks the elapsed pause into paused_ms. No-op if running. */
export function resumeMatch(driver: SqlDriver, id: string, now: number): void {
  driver.execute(
    "UPDATE matches SET paused_ms = paused_ms + (? - paused_at), paused_at = NULL WHERE id = ? AND paused_at IS NOT NULL",
    [now, id],
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
