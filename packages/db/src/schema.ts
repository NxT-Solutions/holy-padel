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
  {
    // Pause support: accumulated paused time, plus the open pause's start (null
    // while running). Match duration = wall-clock − paused_ms − any open pause.
    version: 2,
    statements: [
      "ALTER TABLE matches ADD COLUMN paused_ms INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE matches ADD COLUMN paused_at INTEGER",
    ],
  },
  {
    // Squash support: sport discriminator
    version: 3,
    statements: [
      "ALTER TABLE matches ADD COLUMN sport TEXT NOT NULL DEFAULT 'padel' CHECK (sport IN ('padel', 'squash'))",
    ],
  },
  {
    // Squash scoring configurations and best_of bypass.
    version: 4,
    statements: [
      "ALTER TABLE matches ADD COLUMN squash_mode TEXT CHECK (squash_mode IN ('par', 'hiho'))",
      "ALTER TABLE matches ADD COLUMN squash_target INTEGER",
      "ALTER TABLE matches ADD COLUMN squash_tiebreak TEXT CHECK (squash_tiebreak IN ('winByTwo', 'setOne', 'setTwo'))",
      "ALTER TABLE matches ADD COLUMN squash_best_of INTEGER CHECK (squash_best_of IN (1, 3, 5))",
    ],
  },
  {
    version: 5,
    statements: ["ALTER TABLE matches ADD COLUMN first_serve_pending INTEGER NOT NULL DEFAULT 0"],
  },
  {
    version: 6,
    statements: [
      "ALTER TABLE matches ADD COLUMN padel_best_of INTEGER CHECK (padel_best_of IN (1, 3, 5))",
    ],
  },
  {
    version: 7,
    statements: [
      "ALTER TABLE matches ADD COLUMN first_serve_originally_undecided INTEGER NOT NULL DEFAULT 0",
    ],
  },
  {
    version: 8,
    statements: [
      "ALTER TABLE matches ADD COLUMN pb_type TEXT CHECK (pb_type IN ('singles', 'doubles'))",
      "ALTER TABLE matches ADD COLUMN pb_target INTEGER",
      "ALTER TABLE matches ADD COLUMN pb_tiebreak TEXT CHECK (pb_tiebreak IN ('winByTwo', 'winByOne'))",
      "ALTER TABLE matches ADD COLUMN pb_best_of INTEGER CHECK (pb_best_of IN (1, 3, 5))",
    ],
  },
  {
    version: 9,
    statements: [
      `CREATE TABLE matches_new (
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
        score_line TEXT,
        paused_ms INTEGER NOT NULL DEFAULT 0,
        paused_at INTEGER,
        sport TEXT NOT NULL DEFAULT 'padel' CHECK (sport IN ('padel', 'squash', 'pickleball')),
        squash_mode TEXT CHECK (squash_mode IN ('par', 'hiho')),
        squash_target INTEGER,
        squash_tiebreak TEXT CHECK (squash_tiebreak IN ('winByTwo', 'setOne', 'setTwo')),
        squash_best_of INTEGER CHECK (squash_best_of IN (1, 3, 5)),
        first_serve_pending INTEGER NOT NULL DEFAULT 0,
        padel_best_of INTEGER CHECK (padel_best_of IN (1, 3, 5)),
        first_serve_originally_undecided INTEGER NOT NULL DEFAULT 0,
        pb_type TEXT CHECK (pb_type IN ('singles', 'doubles')),
        pb_target INTEGER,
        pb_tiebreak TEXT CHECK (pb_tiebreak IN ('winByTwo', 'winByOne')),
        pb_best_of INTEGER CHECK (pb_best_of IN (1, 3, 5))
      )`,
      "INSERT INTO matches_new SELECT * FROM matches",
      "DROP TABLE matches",
      "ALTER TABLE matches_new RENAME TO matches",
      "CREATE INDEX idx_matches_status ON matches (status, started_at DESC)",
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
