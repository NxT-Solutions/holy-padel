import type { SqlDriver } from "./driver.ts";
import type { NewMatchDefaults } from "./match-defaults.ts";
import { parseNewMatchDefaults } from "./match-defaults.ts";
import { getSetting, setSetting } from "./settings.ts";

/** A named setup the player can apply to a new match with one tap. */
export interface MatchPreset {
  readonly id: string;
  readonly name: string;
  readonly setup: NewMatchDefaults;
}

const PRESETS_KEY = "matchPresets";
const LAST_SETUP_KEY = "lastSetupBySport";

function readJson(driver: SqlDriver, key: string): unknown {
  const raw = getSetting(driver, key);
  if (raw === undefined || raw === "") {
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    parsed = undefined;
  }
  return parsed;
}

/** One stored preset; anything off (bad id, blank name, invalid setup) is dropped. */
function parsePreset(value: unknown): MatchPreset | undefined {
  if (typeof value !== "object" || value === null) {
    return;
  }
  const row = value as Record<string, unknown>;
  const id = row["id"];
  const name = row["name"];
  const setup = parseNewMatchDefaults(row["setup"]);
  if (
    typeof id !== "string" ||
    id === "" ||
    typeof name !== "string" ||
    name.trim() === "" ||
    setup === undefined
  ) {
    return;
  }
  return { id, name, setup };
}

export function loadMatchPresets(driver: SqlDriver): MatchPreset[] {
  const value = readJson(driver, PRESETS_KEY);
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(parsePreset).filter((preset): preset is MatchPreset => preset !== undefined);
}

function writePresets(driver: SqlDriver, presets: readonly MatchPreset[]): void {
  setSetting(driver, PRESETS_KEY, JSON.stringify(presets));
}

/**
 * Upsert a preset by id. Saving a name that already exists overwrites that
 * preset instead of stacking a duplicate — the name is the user's handle on it.
 */
export function saveMatchPreset(driver: SqlDriver, preset: MatchPreset): void {
  const nameKey = preset.name.trim().toLowerCase();
  const existing = loadMatchPresets(driver);
  const kept = existing.filter(
    (entry) => entry.id === preset.id || entry.name.trim().toLowerCase() !== nameKey,
  );
  const index = kept.findIndex((entry) => entry.id === preset.id);
  writePresets(
    driver,
    index === -1 ? [...kept, preset] : kept.map((entry, i) => (i === index ? preset : entry)),
  );
}

export function deleteMatchPreset(driver: SqlDriver, id: string): void {
  writePresets(
    driver,
    loadMatchPresets(driver).filter((entry) => entry.id !== id),
  );
}

/** The last setup played in one sport, so switching sport restores its rules. */
export function loadLastSetup(
  driver: SqlDriver,
  sport: NewMatchDefaults["sport"],
): NewMatchDefaults | undefined {
  const value = readJson(driver, LAST_SETUP_KEY);
  if (typeof value !== "object" || value === null) {
    return;
  }
  return parseNewMatchDefaults((value as Record<string, unknown>)[sport]);
}

export function saveLastSetup(driver: SqlDriver, setup: NewMatchDefaults): void {
  const value = readJson(driver, LAST_SETUP_KEY);
  const map = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  setSetting(driver, LAST_SETUP_KEY, JSON.stringify({ ...map, [setup.sport]: setup }));
}
