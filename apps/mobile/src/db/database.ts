import type { SqlDriver, SqlRow, SqlValue } from "@holy-padel/db";
import { migrate } from "@holy-padel/db";
import type { SQLiteDatabase } from "expo-sqlite";
import { openDatabaseAsync } from "expo-sqlite";
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

/**
 * Open (and on first launch, migrate + seed) the one local database.
 * The open is asynchronous — on web the sqlite worker must boot before
 * the synchronous query bridge can be used.
 */
export async function openAppDatabase(): Promise<SqlDriver> {
  const database = await openDatabaseAsync("holy-padel.db");
  const driver = expoDriver(database);
  migrate(driver);
  seedIfEmpty(driver);
  return driver;
}
