import type { SqlDriver, SqlRow, SqlValue } from "@holy-padel/db";
import { migrate } from "@holy-padel/db";
import type { SQLiteDatabase } from "expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import { seedIfEmpty } from "./seed.ts";

/** Adapt expo-sqlite's synchronous API to the db package's driver. */
export function expoDriver(database: SQLiteDatabase): SqlDriver {
  return {
    execute: (sql: string, params: readonly SqlValue[] = []): void => {
      database.runSync(sql, [...params]);
    },
    queryAll: (sql: string, params: readonly SqlValue[] = []): SqlRow[] =>
      database.getAllSync<SqlRow>(sql, [...params]),
  };
}

/** Open (and on first launch, migrate + seed) the one local database. */
export function openAppDatabase(): SqlDriver {
  const driver = expoDriver(openDatabaseSync("holy-padel.db"));
  migrate(driver);
  seedIfEmpty(driver);
  return driver;
}
