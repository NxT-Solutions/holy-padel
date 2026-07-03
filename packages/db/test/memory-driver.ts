// biome-ignore lint/correctness/noUnresolvedImports: node:sqlite is a Node builtin Biome's resolver does not know yet
import { DatabaseSync } from "node:sqlite";
import type { SqlDriver, SqlRow, SqlValue } from "../src/index.ts";

/** In-memory SQLite driver for tests, backed by node:sqlite. */
export function memoryDriver(): SqlDriver {
  const db = new DatabaseSync(":memory:");
  return {
    execute(sql: string, params: readonly SqlValue[] = []): void {
      db.prepare(sql).run(...params);
    },
    queryAll(sql: string, params: readonly SqlValue[] = []): SqlRow[] {
      return db.prepare(sql).all(...params) as SqlRow[];
    },
  };
}
