import type { NewMatchDefaults } from "@holy-padel/db";

/** A per-sport memory of the last setup played, keyed by sport. */
export interface LastSetupBySport {
  readonly padel: NewMatchDefaults | undefined;
  readonly squash: NewMatchDefaults | undefined;
  readonly pickleball: NewMatchDefaults | undefined;
}

/**
 * The rule fields a remembered setup contributes when its sport is switched
 * to — the format and that sport's own rules, never the other sports' values.
 */
export function sportRules(setup: NewMatchDefaults): Partial<NewMatchDefaults> {
  if (setup.sport === "squash") {
    return {
      format: setup.format,
      bestOf: setup.bestOf,
      squashMode: setup.squashMode,
      squashTarget: setup.squashTarget,
      squashTiebreak: setup.squashTiebreak,
      squashServeBoxes: setup.squashServeBoxes,
    };
  }
  if (setup.sport === "pickleball") {
    return {
      format: setup.format,
      bestOf: setup.bestOf,
      pbTarget: setup.pbTarget,
      pbTiebreak: setup.pbTiebreak,
    };
  }
  return {
    format: setup.format,
    bestOf: setup.bestOf,
    thirdSet: setup.thirdSet,
    deuceMode: setup.deuceMode,
  };
}

/**
 * The setup after switching to `sport`. A remembered setup wins wholesale;
 * otherwise the current rules carry over with the sport, and padel/pickleball
 * drop a stale best-of-5 rather than coercing it at start time.
 */
export function switchSport(
  current: NewMatchDefaults,
  sport: NewMatchDefaults["sport"],
  remembered: NewMatchDefaults | undefined,
): NewMatchDefaults {
  if (sport === current.sport) {
    return current;
  }
  if (remembered !== undefined) {
    return { ...current, ...sportRules(remembered), sport };
  }
  const staleBestOf = sport !== "squash" && current.bestOf === 5;
  return { ...current, sport, ...(staleBestOf ? { bestOf: 3 as const } : {}) };
}
