import type { SqlDriver } from "./driver.ts";
import { queryOne } from "./driver.ts";

/** Read one app setting; undefined when unset. */
export function getSetting(driver: SqlDriver, key: string): string | undefined {
  const row = queryOne(driver, "SELECT value FROM settings WHERE key = ?", [key]);
  const value = row === undefined ? undefined : row["value"];
  return typeof value === "string" ? value : undefined;
}

/** Write one app setting (upsert). */
export function setSetting(driver: SqlDriver, key: string, value: string): void {
  driver.execute(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value],
  );
}
