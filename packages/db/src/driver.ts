/** Values SQLite can bind and return. */
export type SqlValue = string | number | null;

/** Rows come back as column-name keyed objects. */
export type SqlRow = Record<string, SqlValue>;

/**
 * The minimal surface this package needs from a SQLite binding.
 * The app adapts `expo-sqlite`; tests adapt `node:sqlite`.
 */
export interface SqlDriver {
  readonly execute: (sql: string, params?: readonly SqlValue[]) => void;
  readonly queryAll: (sql: string, params?: readonly SqlValue[]) => SqlRow[];
}

export function queryOne(
  driver: SqlDriver,
  sql: string,
  params?: readonly SqlValue[],
): SqlRow | undefined {
  const [first] = driver.queryAll(sql, params);
  return first;
}

/** Run `work` inside a transaction, rolling back on any thrown error. */
export function inTransaction<T>(driver: SqlDriver, work: () => T): T {
  driver.execute("BEGIN");
  try {
    const result = work();
    driver.execute("COMMIT");
    return result;
  } catch (error) {
    driver.execute("ROLLBACK");
    throw error;
  }
}

export function expectString(row: SqlRow, column: string): string {
  const value = row[column];
  if (typeof value !== "string") {
    throw new Error(`expected text in column ${column}, got ${typeof value}`);
  }
  return value;
}

export function expectNumber(row: SqlRow, column: string): number {
  const value = row[column];
  if (typeof value !== "number") {
    throw new Error(`expected number in column ${column}, got ${typeof value}`);
  }
  return value;
}

export function optionalString(row: SqlRow, column: string): string | undefined {
  const value = row[column];
  if (value === null || value === undefined) {
    return;
  }
  if (typeof value !== "string") {
    throw new Error(`expected text or null in column ${column}, got ${typeof value}`);
  }
  return value;
}

export function optionalNumber(row: SqlRow, column: string): number | undefined {
  const value = row[column];
  if (value === null || value === undefined) {
    return;
  }
  if (typeof value !== "number") {
    throw new Error(`expected number or null in column ${column}, got ${typeof value}`);
  }
  return value;
}
