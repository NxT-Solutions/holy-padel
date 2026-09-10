import type {
  DeuceMode,
  MatchConfig,
  PbTiebreak,
  SquashServeBoxes,
  SquashTiebreak,
  TeamId,
  ThirdSetMode,
} from "@holy-padel/scoring";
import type { SqlDriver } from "./driver.ts";
import { getSetting, setSetting } from "./settings.ts";

/** The scoring options prefilled on the new-match screen. */
export interface NewMatchDefaults {
  readonly format: "singles" | "doubles";
  readonly bestOf: 1 | 3 | 5;
  readonly thirdSet: ThirdSetMode;
  readonly deuceMode: DeuceMode;
  readonly firstServe: TeamId | "undecided";
  readonly sport: "padel" | "squash" | "pickleball";
  readonly squashMode: "par" | "hiho";
  readonly squashTarget: number;
  readonly squashTiebreak: SquashTiebreak;
  readonly squashServeBoxes: SquashServeBoxes;
  readonly pbTarget: number;
  readonly pbTiebreak: PbTiebreak;
}

/**
 * A half-set-up match: the same options plus the picked players, persisted so
 * leaving the new-match screen and coming back restores the work in progress.
 * Cleared when a match actually starts.
 */
export interface MatchDraft extends NewMatchDefaults {
  readonly teamA1: string;
  readonly partner?: string;
  readonly teamB: readonly string[];
  /** Optional pre-match note. */
  readonly note?: string;
}

const DEFAULTS_KEY = "matchDefaults";
const DRAFT_KEY = "matchDraft";

const FORMATS = ["singles", "doubles"] as const;
const BEST_OF = [1, 3, 5] as const;
const THIRD_SETS = ["fullSet", "advantageSet", "superTieBreak"] as const;
const DEUCE_MODES = ["advantage", "starPoint", "goldenPoint"] as const;
const FIRST_SERVES = ["A", "B", "undecided"] as const;
const SPORTS = ["padel", "squash", "pickleball"] as const;
const SQUASH_MODES = ["par", "hiho"] as const;
const SQUASH_TARGETS = [9, 11, 15] as const;
const SQUASH_TIEBREAKS = ["winByTwo", "setOne", "setTwo", "choice"] as const;
const SQUASH_SERVE_BOXES = ["right", "left", "player"] as const;
const PB_TARGETS = [11, 15, 21] as const;
const PB_TIEBREAKS = ["winByTwo", "winByOne"] as const;

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

function intIn<T extends number>(value: unknown, allowed: readonly T[]): T | undefined {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return;
  }
  return allowed.find((option) => option === value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/** Strictly validate a stored defaults blob; anything off returns undefined. */
function parseDefaults(value: unknown): NewMatchDefaults | undefined {
  if (typeof value !== "object" || value === null) {
    return;
  }
  const row = value as Record<string, unknown>;
  const format = oneOf(row["format"], FORMATS);
  const bestOf = intIn(row["bestOf"], BEST_OF);
  const thirdSet = oneOf(row["thirdSet"], THIRD_SETS);
  const deuceMode = oneOf(row["deuceMode"], DEUCE_MODES);
  const firstServe = oneOf(row["firstServe"], FIRST_SERVES);
  const sport = oneOf(row["sport"], SPORTS);
  const squashMode = oneOf(row["squashMode"], SQUASH_MODES);
  const squashTarget = intIn(row["squashTarget"], SQUASH_TARGETS);
  const squashTiebreak = oneOf(row["squashTiebreak"], SQUASH_TIEBREAKS);
  const squashServeBoxes = oneOf(row["squashServeBoxes"], SQUASH_SERVE_BOXES);
  const pbTarget = intIn(row["pbTarget"], PB_TARGETS);
  const pbTiebreak = oneOf(row["pbTiebreak"], PB_TIEBREAKS);
  if (
    format === undefined ||
    bestOf === undefined ||
    thirdSet === undefined ||
    deuceMode === undefined ||
    firstServe === undefined ||
    sport === undefined ||
    squashMode === undefined ||
    squashTarget === undefined ||
    squashTiebreak === undefined ||
    squashServeBoxes === undefined ||
    pbTarget === undefined ||
    pbTiebreak === undefined
  ) {
    return;
  }
  return {
    format,
    bestOf,
    thirdSet,
    deuceMode,
    firstServe,
    sport,
    squashMode,
    squashTarget,
    squashTiebreak,
    squashServeBoxes,
    pbTarget,
    pbTiebreak,
  };
}

function readJson(driver: SqlDriver, key: string): unknown {
  const raw = getSetting(driver, key);
  if (raw === undefined) {
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

export function loadMatchDefaults(driver: SqlDriver): NewMatchDefaults | undefined {
  return parseDefaults(readJson(driver, DEFAULTS_KEY));
}

export function saveMatchDefaults(driver: SqlDriver, defaults: NewMatchDefaults): void {
  setSetting(driver, DEFAULTS_KEY, JSON.stringify(defaults));
}

export function loadMatchDraft(driver: SqlDriver): MatchDraft | undefined {
  const value = readJson(driver, DRAFT_KEY);
  if (typeof value !== "object" || value === null) {
    return;
  }
  const row = value as Record<string, unknown>;
  const defaults = parseDefaults(value);
  const teamA1 = row["teamA1"];
  const partner = row["partner"];
  const teamB = row["teamB"];
  const note = row["note"];
  if (
    defaults === undefined ||
    typeof teamA1 !== "string" ||
    teamA1 === "" ||
    !(typeof partner === "string" || partner === undefined || partner === null) ||
    !isStringArray(teamB) ||
    teamB.length > 2 ||
    !teamB.every((id) => id !== "")
  ) {
    return;
  }
  return {
    ...defaults,
    teamA1,
    ...(typeof partner === "string" ? { partner } : {}),
    teamB,
    ...(typeof note === "string" && note !== "" ? { note } : {}),
  };
}

export function saveMatchDraft(driver: SqlDriver, draft: MatchDraft): void {
  setSetting(driver, DRAFT_KEY, JSON.stringify(draft));
}

export function clearMatchDraft(driver: SqlDriver): void {
  setSetting(driver, DRAFT_KEY, "");
}

/** Padel-format defaults, only when the last match was padel. */
function padelDefaults(
  c: MatchConfig | undefined,
): Pick<NewMatchDefaults, "thirdSet" | "deuceMode"> {
  if (c?.sport !== "padel") {
    return { thirdSet: "superTieBreak", deuceMode: "advantage" };
  }
  return { thirdSet: c.thirdSet, deuceMode: c.deuceMode };
}

/** Squash defaults, only when the last match was squash. */
function squashDefaults(
  c: MatchConfig | undefined,
): Pick<NewMatchDefaults, "squashMode" | "squashTarget" | "squashTiebreak" | "squashServeBoxes"> {
  if (c?.sport !== "squash") {
    return {
      squashMode: "par",
      squashTarget: 11,
      squashTiebreak: "winByTwo",
      squashServeBoxes: "player",
    };
  }
  return {
    squashMode: c.squashMode,
    squashTarget: c.squashTarget,
    squashTiebreak: c.squashTiebreak,
    squashServeBoxes: c.squashServeBoxes ?? "player",
  };
}

/** Pickleball defaults, only when the last match was pickleball. */
function pickleballDefaults(
  c: MatchConfig | undefined,
): Pick<NewMatchDefaults, "pbTarget" | "pbTiebreak"> {
  if (c?.sport !== "pickleball") {
    return { pbTarget: 11, pbTiebreak: "winByTwo" };
  }
  return { pbTarget: c.pbTarget, pbTiebreak: c.pbTiebreak };
}

/** Defaults for the picker, seeded from the most recent match's config. */
export function pickDefaults(c: MatchConfig | undefined): NewMatchDefaults {
  // The app is squash-first: fresh installs (no history, no saved defaults)
  // open on a squash match instead of padel.
  const sport = c?.sport ?? "squash";
  const bestOf = c?.bestOf ?? 3;
  let format: "singles" | "doubles" = "doubles";
  // Squash is overwhelmingly singles — including a fresh install, which opens
  // on squash — and pickleball carries its format on the config.
  if (c === undefined || c.sport === "squash") {
    format = "singles";
  }
  if (c?.sport === "pickleball" && c.pbType === "singles") {
    format = "singles";
  }
  let firstServe: TeamId | "undecided" = "undecided";
  if (c !== undefined) {
    const { firstServePending, firstServe: resolved } = c;
    if (firstServePending !== true) {
      firstServe = resolved;
    }
  }
  return {
    format,
    bestOf,
    firstServe,
    sport,
    ...padelDefaults(c),
    ...squashDefaults(c),
    ...pickleballDefaults(c),
  };
}

/**
 * What the new-match screen opens with, in precedence order: the in-progress
 * draft (leaving and returning must restore the work), then the player's saved
 * defaults, then the last match's config, then the built-in fallbacks.
 */
export function resolveNewMatchDefaults(input: {
  readonly draft?: MatchDraft;
  readonly saved?: NewMatchDefaults;
  readonly lastConfig?: MatchConfig;
}): NewMatchDefaults {
  if (input.draft !== undefined) {
    return input.draft;
  }
  if (input.saved !== undefined) {
    return input.saved;
  }
  return pickDefaults(input.lastConfig);
}
