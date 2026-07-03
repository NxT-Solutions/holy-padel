import type { SqlDriver } from "./driver.ts";
import { expectNumber, inTransaction, queryOne } from "./driver.ts";

interface Migration {
  readonly version: number;
  readonly statements: readonly string[];
}

const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE players (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        club TEXT,
        side TEXT CHECK (side IN ('left', 'right')),
        is_owner INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE matches (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL CHECK (status IN ('live', 'finished')),
        best_of INTEGER NOT NULL CHECK (best_of IN (1, 3)),
        deuce_mode TEXT NOT NULL CHECK (deuce_mode IN ('advantage', 'starPoint', 'goldenPoint')),
        third_set TEXT NOT NULL CHECK (third_set IN ('fullSet', 'advantageSet', 'superTieBreak')),
        first_serve TEXT NOT NULL CHECK (first_serve IN ('A', 'B')),
        team_a_player_1 TEXT NOT NULL REFERENCES players (id),
        team_a_player_2 TEXT NOT NULL REFERENCES players (id),
        team_b_player_1 TEXT NOT NULL REFERENCES players (id),
        team_b_player_2 TEXT NOT NULL REFERENCES players (id),
        court TEXT,
        location TEXT,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        winner TEXT CHECK (winner IN ('A', 'B')),
        score_line TEXT
      )`,
      `CREATE TABLE match_events (
        match_id TEXT NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
        seq INTEGER NOT NULL,
        winner TEXT NOT NULL CHECK (winner IN ('A', 'B')),
        at INTEGER NOT NULL,
        PRIMARY KEY (match_id, seq)
      )`,
      "CREATE INDEX idx_matches_status ON matches (status, started_at DESC)",
      "CREATE INDEX idx_match_events_match ON match_events (match_id, seq)",
    ],
  },
];

/** Bring a database up to the latest schema. Safe to call on every launch. */
export function migrate(driver: SqlDriver): void {
  driver.execute("PRAGMA foreign_keys = ON");
  driver.execute(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)",
  );
  const row = queryOne(
    driver,
    // biome-ignore lint/security/noSecrets: plain SQL, not a credential
    "SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations",
  );
  const current = row === undefined ? 0 : expectNumber(row, "version");
  const pending = MIGRATIONS.filter((migration) => migration.version > current);
  for (const migration of pending) {
    inTransaction(driver, () => {
      for (const statement of migration.statements) {
        driver.execute(statement);
      }
      driver.execute("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)", [
        migration.version,
        Date.now(),
      ]);
    });
  }
}

/** Approximate size of the database file in bytes (profile screen). */
export function databaseSizeBytes(driver: SqlDriver): number {
  const pageCount = queryOne(driver, "PRAGMA page_count");
  const pageSize = queryOne(driver, "PRAGMA page_size");
  if (pageCount === undefined || pageSize === undefined) {
    return 0;
  }
  return expectNumber(pageCount, "page_count") * expectNumber(pageSize, "page_size");
}
