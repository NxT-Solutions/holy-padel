import { requireOptionalNativeModule } from "expo";
import type { LiveNotificationContent } from "./build-notification.ts";

/**
 * Thin JS boundary over the Android-only `LiveNotification` module. On web,
 * iOS and any build without it, `requireOptionalNativeModule` returns null and
 * every call is a no-op.
 */
interface LiveNotificationModule {
  show: (content: LiveNotificationContent) => boolean;
  hide: () => void;
  requestPermission: () => boolean;
  addListener: (
    event: "onAction",
    listener: (payload: { readonly action: string }) => void,
  ) => { remove: () => void };
}

const native = requireOptionalNativeModule<LiveNotificationModule>("LiveNotification");

export function isLiveNotificationAvailable(): boolean {
  return native !== null;
}

/** Post or update the notification; best-effort, never throws. */
export function showLiveNotification(content: LiveNotificationContent): void {
  try {
    native?.show(content);
  } catch {
    // a blocked or failed notification must never break scoring
  }
}

export function hideLiveNotification(): void {
  try {
    native?.hide();
  } catch {
    // nothing to take down
  }
}

/** Ask for the Android 13+ notification permission; true when already granted. */
export function requestLiveNotificationPermission(): boolean {
  try {
    return native?.requestPermission() ?? false;
  } catch {
    return false;
  }
}

/** Subscribe to the notification's button taps. Returns an unsubscribe fn. */
export function addLiveActionListener(listener: (action: string) => void): () => void {
  if (native === null) {
    return () => {
      // no native module (web, iOS) — nothing to unsubscribe
    };
  }
  const subscription = native.addListener("onAction", (payload) => {
    listener(payload.action);
  });
  return () => {
    subscription.remove();
  };
}
