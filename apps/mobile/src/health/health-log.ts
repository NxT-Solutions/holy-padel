import { requireOptionalNativeModule } from "expo";

/**
 * Thin JS boundary over the native `HealthLog` module — HealthKit on iOS,
 * Health Connect on Android. Logs a finished match as a racket-sport workout.
 * The module is optional: on web (or a build without it) every call is a no-op,
 * so the app runs unchanged. Logging is strictly opt-in per match and one-way;
 * the app never reads health data.
 */

interface HealthLogModule {
  /** Health platform present on this device (HealthKit / Health Connect). */
  isAvailable: () => boolean;
  /**
   * Write one workout for a past interval. Resolves true when written, false
   * when the user declined permission or the platform refused. Never rejects
   * for the "no health platform" case — that reports false.
   */
  logWorkout: (startMs: number, endMs: number) => Promise<boolean>;
}

const native = requireOptionalNativeModule<HealthLogModule>("HealthLog");

export function isHealthLogAvailable(): boolean {
  try {
    return native?.isAvailable() ?? false;
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
