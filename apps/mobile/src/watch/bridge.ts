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
  /** Added with the connection-status feature; absent in older native builds. */
  connectedWatchCount?: () => Promise<number>;
}

const native = requireOptionalNativeModule<WatchBridgeModule>("WatchBridge");

export function isWatchBridgeAvailable(): boolean {
  return native !== null;
}

/**
 * How many watches are connected right now (Android: Wear nodes; iOS: not yet
 * implemented). null = unknowable — no bridge, or a native build from before
 * the connection feature. Callers treat null as "don't show watch status".
 */
export async function connectedWatchCountAsync(): Promise<number | null> {
  if (native === null || typeof native.connectedWatchCount !== "function") {
    return null;
  }
  try {
    const count = await native.connectedWatchCount();
    return typeof count === "number" && count >= 0 ? count : null;
  } catch {
    return null;
  }
}

/** Push the latest match state to the watch (already-serialised JSON). */
export function pushWatchStateJson(json: string): void {
  // Best-effort: a missing watch / Play services must never break the phone app.
  try {
    native?.pushState(json);
  } catch {
    // swallow — the next point self-heals the sync
  }
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
  try {
    const subscription = native.addListener("onIntent", (payload) => {
      listener({ path: payload.path, body: payload.body });
    });
    return () => {
      subscription.remove();
    };
  } catch {
    return () => {
      // subscribing failed — best-effort, nothing to unsubscribe
    };
  }
}
