import type { SqlDriver } from "./driver.ts";
import { expectNumber, inTransaction, queryOne } from "./driver.ts";

/**
 * A migration statement is static SQL, or a function that inspects the live
 * database and returns the SQL to run — used by rebuilds that must tolerate
 * older installs whose column sets drifted from the canonical chain.
 */
type MigrationStatement = string | ((driver: SqlDriver) => readonly string[]);

interface Migration {
  readonly version: number;
  readonly statements: readonly MigrationStatement[];
}

/** The canonical matches columns as of version 12, in table order. */
const MATCHES_V12_COLUMNS = [
  "id",
  "status",
  "best_of",
  "deuce_mode",
  "third_set",
  "first_serve",
  "team_a_player_1",
  "team_a_player_2",
  "team_b_player_1",
  "team_b_player_2",
  "court",
  "location",
  "started_at",
  "ended_at",
  "winner",
  "score_line",
  "paused_ms",
  "paused_at",
  "sport",
  "squash_mode",
  "squash_target",
  "squash_tiebreak",
  "squash_best_of",
  "first_serve_pending",
  "padel_best_of",
  "first_serve_originally_undecided",
  "pb_type",
  "pb_target",
  "pb_tiebreak",
  "pb_best_of",
  "squash_serve_boxes",
  "squash_box_a",
  "squash_box_b",
  "pending_game_set",
] as const;

function existingColumns(driver: SqlDriver, table: string): Set<string> {
  const rows = driver.queryAll(`PRAGMA table_info(${table})`) as { readonly name?: unknown }[];
  return new Set(rows.map((row) => String(row.name ?? "")));
}

/**
 * Copy the old matches rows into the rebuilt table. An intermediate dev install
 * may have consumed versions 10/11 with a different column set, so a blind
 * `INSERT ... SELECT *` fails with a column-count mismatch — copy only the
 * columns both tables share; the rest fall back to their defaults. The same
 * drift can leave match_events without the v11 columns, so repair those too.
 */
function copyMatchesIntoNew(driver: SqlDriver): readonly string[] {
  const present = existingColumns(driver, "matches");
  const shared = MATCHES_V12_COLUMNS.filter((column) => present.has(column));
  const list = shared.join(", ");
  const statements = [`INSERT INTO matches_new (${list}) SELECT ${list} FROM matches`];
  const events = existingColumns(driver, "match_events");
  if (!events.has("kind")) {
    statements.push("ALTER TABLE match_events ADD COLUMN kind TEXT NOT NULL DEFAULT 'point'");
  }
  if (!events.has("game_set")) {
    statements.push(
      "ALTER TABLE match_events ADD COLUMN game_set TEXT CHECK (game_set IN ('one', 'two'))",
    );
  }
  return statements;
}

/** Ordered migration chain — exported for tests that replay partial chains. */
export const MIGRATIONS: readonly Migration[] = [
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
  {
    // Squash serve-box preference: fixed right/left, alternate (default), or
    // the per-player preference resolved at match creation (squash_box_a/b).
    version: 10,
    statements: [
      "ALTER TABLE matches ADD COLUMN squash_serve_boxes TEXT CHECK (squash_serve_boxes IN ('alternate', 'right', 'left', 'player'))",
      "ALTER TABLE matches ADD COLUMN squash_box_a TEXT CHECK (squash_box_a IN ('left', 'right'))",
      "ALTER TABLE matches ADD COLUMN squash_box_b TEXT CHECK (squash_box_b IN ('left', 'right'))",
    ],
  },
  {
    // Serve events (undecided first serve of pickleball games 2+), the squash
    // long/short decision riding on a rally, and the staged decision awaiting
    // the next rally.
    version: 11,
    statements: [
      "ALTER TABLE matches ADD COLUMN pending_game_set TEXT CHECK (pending_game_set IN ('one', 'two'))",
      "ALTER TABLE match_events ADD COLUMN kind TEXT NOT NULL DEFAULT 'point'",
      "ALTER TABLE match_events ADD COLUMN game_set TEXT CHECK (game_set IN ('one', 'two'))",
    ],
  },
  {
    // Widen squash_tiebreak with the interactive 'choice' mode. SQLite cannot
    // ALTER a CHECK constraint, so the table is rebuilt in place; column order
    // is preserved so `INSERT INTO ... SELECT *` maps positionally.
    version: 12,
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
         squash_tiebreak TEXT CHECK (squash_tiebreak IN ('winByTwo', 'setOne', 'setTwo', 'choice')),
         squash_best_of INTEGER CHECK (squash_best_of IN (1, 3, 5)),
         first_serve_pending INTEGER NOT NULL DEFAULT 0,
         padel_best_of INTEGER CHECK (padel_best_of IN (1, 3, 5)),
         first_serve_originally_undecided INTEGER NOT NULL DEFAULT 0,
         pb_type TEXT CHECK (pb_type IN ('singles', 'doubles')),
         pb_target INTEGER,
         pb_tiebreak TEXT CHECK (pb_tiebreak IN ('winByTwo', 'winByOne')),
         pb_best_of INTEGER CHECK (pb_best_of IN (1, 3, 5)),
         squash_serve_boxes TEXT CHECK (squash_serve_boxes IN ('alternate', 'right', 'left', 'player')),
         squash_box_a TEXT CHECK (squash_box_a IN ('left', 'right')),
         squash_box_b TEXT CHECK (squash_box_b IN ('left', 'right')),
          pending_game_set TEXT CHECK (pending_game_set IN ('one', 'two'))
        )`,
      copyMatchesIntoNew,
      "DROP TABLE matches",
      "ALTER TABLE matches_new RENAME TO matches",
      "CREATE INDEX idx_matches_status ON matches (status, started_at DESC)",
    ],
  },
  {
    // Key/value app settings — home of the theme preference.
    version: 13,
    statements: ["CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)"],
  },
  {
    // Removed-player tombstones: "delete profile, keep matches" re-points the
    // deleted player's match slots at a shared placeholder row (removed = 1)
    // so the foreign keys hold and the match history survives. Tombstones are
    // filtered out of every roster/profile listing.
    version: 14,
    statements: ["ALTER TABLE players ADD COLUMN removed INTEGER NOT NULL DEFAULT 0"],
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
        if (typeof statement === "function") {
          for (const sql of statement(driver)) {
            driver.execute(sql);
          }
        } else {
          driver.execute(statement);
        }
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

// The settings table arrives with the theme preference (migration 13); kept
// alongside the migrations above so the file reads as one schema history.
