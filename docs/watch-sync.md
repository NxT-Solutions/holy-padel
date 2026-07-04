# Phone ↔ watch sync contract

The phone is the **single source of truth**: it owns the SQLite ledger and the
`@holy-padel/scoring` engine. The watch is a thin mirror — it renders the match
state the phone pushes, and sends back score/undo *intents*. The watch never
runs the scoring engine, so there is exactly one implementation of the rules.

This is transport-agnostic: on Apple Watch it rides **WatchConnectivity**
(`updateApplicationContext` for state, `sendMessage` for intents); on Wear OS it
rides the **Wearable Data Layer** (`DataClient` for state, `MessageClient` for
intents). Both carry the same JSON payloads defined here.

## Phone → watch: match state

Sent whenever the live match changes (point scored, undo, match finished) and on
conn+resume. Latest-wins (application context / a single Data Layer item at path
`/holy-padel/state`).

```jsonc
{
  "v": 1,                         // schema version
  "phase": "idle" | "live" | "won",
  "clock": "0:47",                // elapsed, mm or h:mm — empty when idle
  "court": "COURT 4",             // may be absent
  "setLabel": "SET 2",            // current set, e.g. "SET 2" / "SUPER TB"
  "teamA": { "short": "N&J", "serving": true },
  "teamB": { "short": "M&L", "serving": false },
  "pointA": "40",                 // display call: 0/15/30/40/AD or tie-break number
  "pointB": "30",
  "games": "6-4 · 4-3",           // completed sets + current, the live score line
  "status": "GAME PT",            // watchStatusLabel(), may be empty
  "won": {                        // present only when phase = "won"
    "winnerShort": "N&J",
    "scoreLine": "6-4 · 7-5",
    "duration": "1:23"
  },
  "last": {                       // present when phase = "idle" (quick-start hint)
    "line": "6-3 7-6 vs M&L",
    "won": true
  }
}
```

## Watch → phone: intents

Fire-and-forget messages; the phone applies them to the engine, persists, and
pushes fresh state back.

| Path                     | Body        | Effect on the phone                          |
| ------------------------ | ----------- | -------------------------------------------- |
| `/holy-padel/score`      | `"A"`\|`"B"`| Append a point event for that team           |
| `/holy-padel/undo`       | `""`        | Remove the last point event                   |
| `/holy-padel/start-last` | `""`        | From idle: start a rematch of the last lineup |

## Transport specifics

The two platforms carry the identical JSON above; only the wire differs.

### Wear OS — Wearable Data Layer

- **State:** the phone puts a single `DataItem` at path `/holy-padel/state`
  holding the state JSON; the watch's `DataClient.OnDataChangedListener` reads it
  and pulls the existing item on connect. Latest-wins is native to `DataItem`.
- **Intents:** the watch sends a `MessageClient` message to the path above with
  the body as the message bytes, to every connected node.

### Apple Watch — WatchConnectivity

- **State:** the phone calls `updateApplicationContext(["state": "<json>"])`
  (latest-wins, survives relaunch); when the watch is reachable it may also
  arrive via `sendMessage`. The watch decodes the `"state"` string either way.
- **Intents:** the watch sends `sendMessage(["path": "/holy-padel/…", "body": …])`
  when reachable, falling back to `transferUserInfo` (queued, background-tolerant)
  when the phone is asleep. Using the same `{ path, body }` shape as the Wear OS
  paths lets the phone decode both transports with one code path.

## Phone-side pipeline

The phone half of the sync lives in [`apps/mobile/src/watch`](../apps/mobile/src/watch):

1. **`build-state.ts`** — `buildWatchState()` maps the live/finished/absent match to
   the state payload above, reusing the phone's own formatters (`watchStatusLabel`,
   `liveScoreLine`, `durationLabel`, …). Pure and unit-tested.
2. **`apply-intent.ts`** — `applyWatchIntent()` applies a `{ path, body }` intent to
   the ledger with the same writes the live screen uses (`appendEvent`,
   `removeLastEvent`, `createMatch`). Pure and unit-tested.
3. **`use-watch-sync.ts`** — `useWatchSync()` (mounted once under `DbProvider`)
   rebuilds and pushes the payload on every ledger mutation and a 30 s clock tick,
   and feeds incoming intents through `applyWatchIntent`.
4. **`bridge.ts`** — the boundary to the native transport, resolved with
   `requireOptionalNativeModule("WatchBridge")`. When no native module is linked
   (web, or a build without it) every call is a no-op, so the phone app is unchanged.

### Native `WatchBridge` module

The transport is a local Expo module named **`WatchBridge`**
([`apps/mobile/modules/watch-bridge`](../apps/mobile/modules/watch-bridge)) that
autolinks into the app on `expo prebuild`. It exposes:

- `pushState(json: string): void` — publish the state JSON to the paired watch.
  - **Android** (`WatchBridgeModule.kt`): `Wearable.getDataClient(context).putDataItem`
    of a `PutDataMapRequest` at `/holy-padel/state` with `dataMap.putString("json", json)`
    (plus a bumped `ts` key so identical-looking updates still propagate) — the exact
    `"json"` key at `/holy-padel/state` the Wear app reads (`WatchSync.kt`).
  - **iOS** (`WatchBridgeModule.swift`): `WCSession.updateApplicationContext(["state": json])`,
    plus `sendMessage(["state": json])` when reachable — the `"state"` key the watch
    target decodes (`WatchConnectivityManager.swift`).
- an **`onIntent`** event carrying `{ path, body }` — emitted when the watch sends one.
  - **Android:** a `MessageClient.OnMessageReceivedListener` → `{ path: event.path,
    body: String(event.data) }`.
  - **iOS:** `WCSessionDelegate.session(_:didReceiveMessage:)` / `didReceiveUserInfo`.

Both platforms are compiled on every change by the
[`watch-bridge`](../.github/workflows/watch-bridge.yml) workflow (Kotlin via Gradle,
Swift via `xcodebuild`). End-to-end Bluetooth pairing is only exercisable on
physically paired devices.

## Notes

- The watch UI derives entirely from `phase`: `idle` → quick-start card,
  `live` → the scoreboard (square + round variants), `won` → the celebration.
- Serving dots, status pill and point calls come straight from the fields above —
  the watch does no scoring math.
- Because the payload is tiny and latest-wins, a missed update self-heals on the
  next point; there is no event replay on the watch.
