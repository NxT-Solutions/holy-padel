import { requireOptionalNativeModule } from "expo";

/**
 * Thin JS boundary over the native `HealthLog` module — HealthKit on iOS,
 * Health Connect on Android. Logs a finished match as a racket-sport workout.
 * The module is optional: on web (or a build without it) every call is a no-op,
 * so the app runs unchanged. Logging is strictly opt-in per match and one-way;
 * the app never reads health data.
 */

/**
 * Coarse share-authorization state for the workout type, used to decide
 * whether the Profile screen should offer to connect. `"unavailable"` means
 * there is no health platform (web, or a device without HealthKit / Health
 * Connect); the app treats it exactly like "nothing to offer".
 */
export type HealthStatus = "granted" | "denied" | "undetermined" | "unavailable";

interface HealthLogModule {
  /** Health platform present on this device (HealthKit / Health Connect). */
  isAvailable: () => boolean;
  /** Current share-authorization state for the workout type. */
  getAuthorizationStatus: () => Promise<HealthStatus>;
  /**
   * Prompt for workout write access. Resolves true when the request completed
   * (iOS) or every write permission was granted (Android); the caller re-reads
   * getHealthStatus afterwards to learn the resulting state. Never rejects.
   */
  requestAuthorization: () => Promise<boolean>;
  /**
   * Write one workout for a past interval. Resolves true when written, false
   * when the user declined permission or the platform refused. Never rejects
   * for the "no health platform" case — that reports false.
   */
  logWorkout: (startMs: number, endMs: number) => Promise<boolean>;
  /**
   * Write the rich watch-tracked workout (session + heart-rate series +
   * calories) from a `/holy-padel/workout` summary JSON. Android-only in
   * practice — the Apple Watch saves its own session directly.
   */
  logWatchWorkout: (summaryJson: string) => Promise<boolean>;
}

const native = requireOptionalNativeModule<HealthLogModule>("HealthLog");

export function isHealthLogAvailable(): boolean {
  try {
    return native?.isAvailable() ?? false;
  } catch {
    return false;
  }
}

/**
 * Read the current health authorization state. Falls back to "unavailable"
 * with no native module (web) or on any failure, so callers can treat it as
 * "don't offer to connect" without special-casing.
 */
export async function getHealthStatus(): Promise<HealthStatus> {
  if (native === null) {
    return "unavailable";
  }
  try {
    return await native.getAuthorizationStatus();
  } catch {
    return "unavailable";
  }
}

/** Prompt for workout write access. Best-effort: resolves false on any failure. */
export async function requestHealthAuthorization(): Promise<boolean> {
  if (native === null) {
    return false;
  }
  try {
    return await native.requestAuthorization();
  } catch {
    return false;
  }
}

/** Log a finished match as a workout. Best-effort: resolves false on any failure. */
export async function logMatchWorkout(startMs: number, endMs: number): Promise<boolean> {
  if (native === null || endMs <= startMs) {
    return false;
  }
  try {
    return await native.logWorkout(startMs, endMs);
  } catch {
    return false;
  }
}

/** Persist a watch-tracked workout summary. Best-effort like everything here. */
export async function logWatchWorkout(summaryJson: string): Promise<boolean> {
  if (native === null) {
    return false;
  }
  try {
    return await native.logWatchWorkout(summaryJson);
  } catch {
    return false;
  }
}
