import { ImpactFeedbackStyle, impactAsync } from "expo-haptics";
import { Platform } from "react-native";

/**
 * Light impact feedback for scoring a point — the phone-side counterpart of
 * the watch's 20 ms vibration. Best-effort: haptics must never break scoring.
 */

export function scoreHaptic(): void {
  if (Platform.OS === "web") {
    return;
  }
  try {
    void impactAsync(ImpactFeedbackStyle.Light);
  } catch {
    // no haptics hardware / permission — ignore
  }
}

/** A slightly heavier tick for undo, so the two actions feel different. */
export function undoHaptic(): void {
  if (Platform.OS === "web") {
    return;
  }
  try {
    void impactAsync(ImpactFeedbackStyle.Medium);
  } catch {
    // ignore
  }
}
