import type { SqlDriver, SqlRow, SqlValue } from "./driver.ts";
import { expectNumber, expectString, inTransaction, optionalString, queryOne } from "./driver.ts";

export type CourtSide = "left" | "right";

/**
 * How a player deletion treats the matches they appear in: "withMatches"
 * removes those matches (and their events) along with the player; "keepMatches"
 * re-points the deleted player's match slots at the shared tombstone so the
 * match history survives with a "Former player" label.
 */
export type PlayerDeleteMode = "withMatches" | "keepMatches";

/** The hidden placeholder row that keeps kept matches valid after a deletion. */
export const REMOVED_PLAYER_ID = "removed-player";

export interface Player {
  readonly id: string;
  readonly name: string;
  readonly club: string | undefined;
  readonly side: CourtSide | undefined;
  /** The profile owner — the person whose phone this is. */
  readonly isOwner: boolean;
  /** A deletion placeholder, never listed or pickable. */
  readonly removed: boolean;
  readonly createdAt: number;
}

export interface NewPlayer {
  readonly id: string;
  readonly name: string;
  readonly club?: string;
  readonly side?: CourtSide;
  readonly isOwner?: boolean;
  readonly createdAt: number;
}

/** A roster entry for the player picker: "14 matches with you". */
export interface RosterEntry extends Player {
  readonly matchesWithOwner: number;
}

function toPlayer(row: SqlRow): Player {
  const side = optionalString(row, "side");
  if (side !== undefined && side !== "left" && side !== "right") {
    throw new Error(`invalid court side: ${side}`);
  }
  return {
    id: expectString(row, "id"),
    name: expectString(row, "name"),
    club: optionalString(row, "club"),
    side,
    isOwner: expectNumber(row, "is_owner") === 1,
    removed: expectNumber(row, "removed") === 1,
    createdAt: expectNumber(row, "created_at"),
  };
}

export function createPlayer(driver: SqlDriver, player: NewPlayer): void {
  driver.execute(
    "INSERT INTO players (id, name, club, side, is_owner, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [
      player.id,
      player.name,
      player.club ?? null,
      player.side ?? null,
      player.isOwner === true ? 1 : 0,
      player.createdAt,
    ],
  );
}

export function updatePlayer(
  driver: SqlDriver,
  id: string,
  changes: { readonly name?: string; readonly club?: string; readonly side?: CourtSide | null },
): void {
  const sets: string[] = [];
  const params: SqlValue[] = [];
  if (changes.name !== undefined) {
    sets.push("name = ?");
    params.push(changes.name);
  }
  if (changes.club !== undefined) {
    sets.push("club = ?");
    params.push(changes.club);
  }
  if (changes.side !== undefined) {
    sets.push("side = ?");
    params.push(changes.side);
  }
  if (sets.length === 0) {
    return;
  }
  params.push(id);
  driver.execute(`UPDATE players SET ${sets.join(", ")} WHERE id = ?`, params);
}

export function getPlayer(driver: SqlDriver, id: string): Player | undefined {
  const row = queryOne(driver, "SELECT * FROM players WHERE id = ? AND removed = 0", [id]);
  return row === undefined ? undefined : toPlayer(row);
}

export function getOwner(driver: SqlDriver): Player | undefined {
  const row = queryOne(driver, "SELECT * FROM players WHERE is_owner = 1 AND removed = 0 LIMIT 1");
  return row === undefined ? undefined : toPlayer(row);
}

export function listPlayers(driver: SqlDriver): Player[] {
  return driver.queryAll("SELECT * FROM players WHERE removed = 0 ORDER BY name").map(toPlayer);
}

/**
 * Roster for the player picker, ordered by how often each player has been
 * in a match with the owner ("14 matches with you" in the design).
 */
export function listRoster(driver: SqlDriver): RosterEntry[] {
  const rows = driver.queryAll(
    `SELECT p.*, (
       SELECT COUNT(*) FROM matches m
       WHERE EXISTS (
         SELECT 1 FROM players o
         WHERE o.is_owner = 1
           AND o.id IN (m.team_a_player_1, m.team_a_player_2, m.team_b_player_1, m.team_b_player_2)
       )
       AND p.id IN (m.team_a_player_1, m.team_a_player_2, m.team_b_player_1, m.team_b_player_2)
     ) AS matches_with_owner
     FROM players p
     WHERE p.removed = 0
     ORDER BY matches_with_owner DESC, p.name`,
  );
  return rows.map((row) => ({
    ...toPlayer(row),
    matchesWithOwner: expectNumber(row, "matches_with_owner"),
  }));
}

/** How many stored matches feature the player in any slot. */
export function countPlayerMatches(driver: SqlDriver, id: string): number {
  const row = queryOne(
    driver,
    `SELECT COUNT(*) AS n FROM matches
     WHERE ? IN (team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2)`,
    [id],
  );
  return row === undefined ? 0 : expectNumber(row, "n");
}

const PLAYER_MATCH_IDS = `
  SELECT id FROM matches
  WHERE ? IN (team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2)`;

/**
 * Delete a player. With "withMatches", every match they appear in is removed
 * too (events first, then the matches). With "keepMatches", their match slots
 * are re-pointed at the shared "Former player" tombstone before the row goes,
 * so the foreign keys hold and the history stays intact. Deleting the profile
 * owner is refused. Missing players are a no-op, making the call idempotent.
 */
export function deletePlayer(driver: SqlDriver, id: string, mode: PlayerDeleteMode): void {
  inTransaction(driver, () => {
    const row = queryOne(driver, "SELECT is_owner FROM players WHERE id = ?", [id]);
    if (row === undefined) {
      return;
    }
    if (expectNumber(row, "is_owner") === 1) {
      throw new Error("cannot delete the profile owner");
    }
    if (mode === "withMatches") {
      for (const match of driver.queryAll(PLAYER_MATCH_IDS, [id])) {
        const matchId = expectString(match, "id");
        driver.execute("DELETE FROM match_events WHERE match_id = ?", [matchId]);
        driver.execute("DELETE FROM matches WHERE id = ?", [matchId]);
      }
    } else {
      driver.execute(
        `INSERT INTO players (id, name, is_owner, removed, created_at)
         VALUES (?, 'Former player', 0, 1, ?)
         ON CONFLICT(id) DO NOTHING`,
        [REMOVED_PLAYER_ID, Date.now()],
      );
      for (const column of [
        "team_a_player_1",
        "team_a_player_2",
        "team_b_player_1",
        "team_b_player_2",
      ]) {
        driver.execute(`UPDATE matches SET ${column} = ? WHERE ${column} = ?`, [
          REMOVED_PLAYER_ID,
          id,
        ]);
      }
    }
    driver.execute("DELETE FROM players WHERE id = ?", [id]);
  });
}
