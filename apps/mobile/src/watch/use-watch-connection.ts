import { useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { addIntentListener, connectedWatchCountAsync, isWatchBridgeAvailable } from "./bridge.ts";

/**
 * How many watches are connected right now, observed app-wide. The native
 * bridge has no push event for connection changes, so the store polls
 * `connectedWatchCount` every few seconds and refreshes early whenever a
 * watch intent arrives (an intent is itself proof of a connection) and when
 * the app returns to the foreground.
 */

const POLL_MS = 8000;

export interface WatchLink {
  /** False when this build has no watch bridge at all (e.g. web). */
  readonly available: boolean;
  /** Connected watch count; null until the first query lands. */
  readonly count: number | null;
}

// The e2e suite runs on web where no native bridge exists; a mock count lets
// the "Synced — N watches connected" UI be exercised for real.
// biome-ignore lint/style/noProcessEnv: Expo inlines EXPO_PUBLIC_* at bundle time
// biome-ignore lint/correctness/noProcessGlobal: Expo's standard env access
// biome-ignore lint/complexity/useLiteralKeys: tsc requires the index form
const MOCK_COUNT = Number(process.env["EXPO_PUBLIC_MOCK_WATCH_COUNT"] ?? "");

const isMocked = Number.isInteger(MOCK_COUNT) && MOCK_COUNT > 0;

let state: WatchLink = {
  available: isWatchBridgeAvailable() || isMocked,
  count: isMocked ? MOCK_COUNT : null,
};

const listeners = new Set<() => void>();
let started = false;

function setState(next: WatchLink): void {
  if (state.available === next.available && state.count === next.count) {
    return;
  }
  state = next;
  for (const listener of listeners) {
    listener();
  }
}

async function refresh(): Promise<void> {
  const count = await connectedWatchCountAsync();
  // null (no bridge / old native build) keeps the last known count — the UI
  // hides itself rather than flapping between "offline" and unknown.
  if (count !== null) {
    setState({ available: true, count });
  }
}

function start(): void {
  if (started) {
    return;
  }
  started = true;
  if (isMocked) {
    return;
  }
  void refresh();
  setInterval(() => {
    void refresh();
  }, POLL_MS);
  // A watch sending an intent is connected by definition — refresh at once.
  addIntentListener(() => {
    void refresh();
  });
  AppState.addEventListener("change", (next) => {
    if (next === "active") {
      void refresh();
    }
  });
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  start();
  return () => {
    listeners.delete(onChange);
  };
}

/** Live watch-connection status for the sync indicator and home pill. */
export function useWatchLink(): WatchLink {
  useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
  return state;
}
