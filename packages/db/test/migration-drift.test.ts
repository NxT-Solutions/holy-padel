import { describe, expect, it } from "vitest";
import type { SqlDriver, SqlValue } from "../src/driver.ts";
import { MIGRATIONS, migrate } from "../src/schema.ts";
import { memoryDriver } from "./memory-driver.ts";

/** Apply a migration's static statements (test helper for partial chains). */
function apply(driver: SqlDriver, version: number): void {
  const migration = MIGRATIONS.find((entry) => entry.version === version);
  if (migration === undefined) {
    throw new Error(`no migration ${String(version)}`);
  }
  for (const statement of migration.statements) {
    if (typeof statement === "string") {
      driver.execute(statement);
    }
  }
  driver.execute("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)", [version, 0]);
}

/**
 * Reproduce the drifted schema found on a long-lived dev install: versions
 * 10/11 were consumed by an intermediate build whose columns differ from the
 * canonical chain, leaving matches with 32 columns and match_events without
 * the event-kind columns. The version-12 rebuild must still succeed.
 */
describe("migration 12 over a drifted schema", () => {
  it("copies shared columns, defaults the rest, and repairs match_events", () => {
    const driver = memoryDriver();
    driver.execute(
      "CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)",
    );
    for (let version = 1; version <= 9; version += 1) {
      apply(driver, version);
    }
    // The drifted v10/v11 of the intermediate dev build: only two of the four
    // squash columns, and no event-kind columns.
    driver.execute(
      "ALTER TABLE matches ADD COLUMN squash_serve_boxes TEXT CHECK (squash_serve_boxes IN ('alternate', 'right', 'left', 'player'))",
    );
    driver.execute(
      "ALTER TABLE matches ADD COLUMN squash_box_a TEXT CHECK (squash_box_a IN ('left', 'right'))",
    );
    driver.execute("INSERT INTO schema_migrations (version, applied_at) VALUES (10, 0)");
    driver.execute("INSERT INTO schema_migrations (version, applied_at) VALUES (11, 0)");

    // Seed one finished padel match through the drifted shape.
    for (const id of ["nico", "javi", "marta", "leo"]) {
      driver.execute("INSERT INTO players (id, name, is_owner, created_at) VALUES (?, ?, 0, 0)", [
        id,
        id,
      ]);
    }
    const values: readonly (readonly [string, SqlValue])[] = [
      ["id", "m1"],
      ["status", "finished"],
      ["best_of", 3],
      ["deuce_mode", "goldenPoint"],
      ["third_set", "superTieBreak"],
      ["first_serve", "A"],
      ["team_a_player_1", "nico"],
      ["team_a_player_2", "javi"],
      ["team_b_player_1", "marta"],
      ["team_b_player_2", "leo"],
      ["started_at", 1],
      ["ended_at", 2],
      ["winner", "A"],
      ["score_line", "6-4 · 6-3"],
      ["sport", "padel"],
      ["squash_serve_boxes", "alternate"],
    ];
    driver.execute(
      `INSERT INTO matches (${values.map(([column]) => column).join(", ")}) VALUES (${values
        .map(() => "?")
        .join(", ")})`,
      values.map(([, value]) => value),
    );

    expect(() => migrate(driver)).not.toThrow();

    // Latest version recorded and the row survived with its shared columns intact.
    const [versionRow] = driver.queryAll("SELECT MAX(version) AS v FROM schema_migrations") as {
      readonly v?: unknown;
    }[];
    expect(Number(versionRow?.v)).toBe(15);
    const [row] = driver.queryAll("SELECT * FROM matches WHERE id = 'm1'");
    if (row === undefined) {
      throw new Error("migrated match row missing");
    }
    const {
      score_line: scoreLine,
      winner,
      deuce_mode: deuceMode,
      pending_game_set: pendingGameSet,
      squash_box_b: squashBoxB,
      pb_type: pbType,
    } = row;
    expect(scoreLine).toBe("6-4 · 6-3");
    expect(winner).toBe("A");
    expect(deuceMode).toBe("goldenPoint");
    // Missing columns now exist with their defaults.
    expect(pendingGameSet).toBeNull();
    expect(squashBoxB).toBeNull();
    expect(pbType).toBeNull();
    // The widened tie-break CHECK accepts the interactive 'choice' value.
    expect(() => {
      driver.execute("UPDATE matches SET squash_tiebreak = 'choice' WHERE id = 'm1'");
    }).not.toThrow();
    // match_events gained the event-kind columns.
    const eventRows = driver.queryAll("PRAGMA table_info(match_events)") as {
      readonly name?: unknown;
    }[];
    const eventColumns = eventRows.map((eventRow) => eventRow.name);
    expect(eventColumns).toContain("kind");
    expect(eventColumns).toContain("game_set");
  });
});
