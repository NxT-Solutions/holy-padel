import { requireOptionalNativeModule } from "expo";
import type { WatchIntent } from "./apply-intent.ts";
import type { WatchState } from "./build-state.ts";

/**
 * Thin JS boundary over the native `WatchBridge` module (WatchConnectivity on
 * iOS, Wearable Data Layer on Android). The module is optional: on web — and any
 * build where it isn't linked — `requireOptionalNativeModule` returns null and
 * every call here becomes a no-op, so the phone app runs unchanged.
 */

interface IntentPayload {
  readonly path: string;
  readonly body: string;
}

interface WatchBridgeModule {
  pushState: (json: string) => void;
  addListener: (
    event: "onIntent",
    listener: (payload: IntentPayload) => void,
  ) => { remove: () => void };
}

const native = requireOptionalNativeModule<WatchBridgeModule>("WatchBridge");

export function isWatchBridgeAvailable(): boolean {
  return native !== null;
}

/** Push the latest match state to the watch (already-serialised JSON). */
export function pushWatchStateJson(json: string): void {
  native?.pushState(json);
}

export function pushWatchState(state: WatchState): void {
  pushWatchStateJson(JSON.stringify(state));
}

/** Subscribe to intents coming back from the watch. Returns an unsubscribe fn. */
export function addIntentListener(listener: (intent: WatchIntent) => void): () => void {
  if (native === null) {
    return () => {
      // no native bridge (e.g. web) — nothing to unsubscribe
    };
  }
  const subscription = native.addListener("onIntent", (payload) => {
    listener({ path: payload.path, body: payload.body });
  });
  return () => {
    subscription.remove();
  };
}
