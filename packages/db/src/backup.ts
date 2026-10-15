import type { SqlDriver, SqlRow } from "./driver.ts";
import { expectString, inTransaction } from "./driver.ts";

/**
 * A full local backup: raw dumps of every table, so a restore reproduces the
 * database byte-for-byte (configs, ledgers, notes, heart-rate series and
 * settings included). Exported/ imported by the "your data" screen.
 */

const BACKUP_VERSION = 1;

export type BackupRow = SqlRow;

export interface BackupData {
  readonly version: number;
  readonly exportedAt: number;
  readonly players: readonly BackupRow[];
  readonly matches: readonly BackupRow[];
  readonly matchEvents: readonly BackupRow[];
  readonly settings: readonly BackupRow[];
}

/** Column names are always snake_case schema identifiers — never user input. */
const SAFE_COLUMN = /^[a-z_]+$/u;

function dumpTable(driver: SqlDriver, table: string): BackupRow[] {
  return driver.queryAll(`SELECT * FROM ${table}`);
}

export function exportBackup(driver: SqlDriver): BackupData {
  return {
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    players: dumpTable(driver, "players"),
    matches: dumpTable(driver, "matches"),
    matchEvents: dumpTable(driver, "match_events"),
    settings: dumpTable(driver, "settings"),
  };
}

function insertRows(
  driver: SqlDriver,
  table: string,
  rows: readonly BackupRow[],
  required: readonly string[],
): void {
  for (const row of rows) {
    for (const column of required) {
      if (row[column] === undefined) {
        throw new Error(`backup row in ${table} is missing ${column}`);
      }
    }
    const columns = Object.keys(row).filter((column) => SAFE_COLUMN.test(column));
    if (columns.length === 0) {
      throw new Error(`backup row in ${table} has no usable columns`);
    }
    const values = columns.map((column) => row[column] ?? null);
    const placeholders = columns.map(() => "?").join(", ");
    driver.execute(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`, values);
  }
}

/**
 * Replace everything on the phone with the backup. One transaction: a bad or
 * truncated file rolls back and leaves the existing data untouched.
 */
export function importBackup(driver: SqlDriver, data: BackupData): void {
  if (data.version !== BACKUP_VERSION) {
    throw new Error(`unsupported backup version: ${String(data.version)}`);
  }
  const players = asRows(data.players);
  const matches = asRows(data.matches);
  const events = asRows(data.matchEvents);
  const settings = asRows(data.settings);

  // Every match slot must point at a player the backup carries — otherwise
  // the foreign keys would reject the restore halfway through.
  const playerIds = new Set(players.map((row) => expectString(row, "id")));
  for (const match of matches) {
    for (const column of [
      "team_a_player_1",
      "team_a_player_2",
      "team_b_player_1",
      "team_b_player_2",
    ]) {
      const value = match[column];
      if (typeof value === "string" && !playerIds.has(value)) {
        throw new Error(`backup match references unknown player: ${value}`);
      }
    }
  }

  inTransaction(driver, () => {
    driver.execute("DELETE FROM match_events");
    driver.execute("DELETE FROM matches");
    driver.execute("DELETE FROM players");
    driver.execute("DELETE FROM settings");
    insertRows(driver, "players", players, ["id", "name", "is_owner", "created_at"]);
    insertRows(driver, "matches", matches, [
      "id",
      "status",
      "best_of",
      "deuce_mode",
      "third_set",
      "first_serve",
      "team_a_player_1",
      "team_b_player_1",
      "started_at",
    ]);
    insertRows(driver, "match_events", events, ["match_id", "seq", "winner", "at"]);
    insertRows(driver, "settings", settings, ["key", "value"]);
  });
}

/** Coerce parsed JSON into a BackupData, or throw with a readable message. */
export function parseBackup(value: unknown): BackupData {
  if (typeof value !== "object" || value === null) {
    throw new Error("not a Holy Padel backup file");
  }
  const row = value as {
    version?: unknown;
    exportedAt?: unknown;
    players?: unknown;
    matches?: unknown;
    matchEvents?: unknown;
    settings?: unknown;
  };
  if (row.version !== BACKUP_VERSION) {
    throw new Error("not a Holy Padel backup file");
  }
  return {
    version: BACKUP_VERSION,
    exportedAt: typeof row.exportedAt === "number" ? row.exportedAt : 0,
    players: asRows(row.players),
    matches: asRows(row.matches),
    matchEvents: asRows(row.matchEvents),
    settings: asRows(row.settings),
  };
}

function asRows(value: unknown): BackupRow[] {
  if (!Array.isArray(value)) {
    throw new Error("backup is missing a table dump");
  }
  return value.filter((row): row is BackupRow => typeof row === "object" && row !== null);
}
