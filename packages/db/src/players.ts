import type { SqlDriver, SqlRow } from "./driver.ts";
import { expectNumber, expectString, optionalString, queryOne } from "./driver.ts";

export type CourtSide = "left" | "right";

export interface Player {
  readonly id: string;
  readonly name: string;
  readonly club: string | undefined;
  readonly side: CourtSide | undefined;
  /** The profile owner — the person whose phone this is. */
  readonly isOwner: boolean;
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
  changes: { readonly name?: string; readonly club?: string; readonly side?: CourtSide },
): void {
  driver.execute(
    "UPDATE players SET name = COALESCE(?, name), club = COALESCE(?, club), side = COALESCE(?, side) WHERE id = ?",
    [changes.name ?? null, changes.club ?? null, changes.side ?? null, id],
  );
}

export function getPlayer(driver: SqlDriver, id: string): Player | undefined {
  const row = queryOne(driver, "SELECT * FROM players WHERE id = ?", [id]);
  return row === undefined ? undefined : toPlayer(row);
}

export function getOwner(driver: SqlDriver): Player | undefined {
  const row = queryOne(driver, "SELECT * FROM players WHERE is_owner = 1 LIMIT 1");
  return row === undefined ? undefined : toPlayer(row);
}

export function listPlayers(driver: SqlDriver): Player[] {
  return driver.queryAll("SELECT * FROM players ORDER BY name").map(toPlayer);
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
     WHERE p.is_owner = 0
     ORDER BY matches_with_owner DESC, p.name`,
  );
  return rows.map((row) => ({
    ...toPlayer(row),
    matchesWithOwner: expectNumber(row, "matches_with_owner"),
  }));
}
