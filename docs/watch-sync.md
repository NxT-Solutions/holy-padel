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
  "startedAt": 1783200000000,     // epoch ms the match started — the watch's
                                  // workout-session start time and cross-device
                                  // dedup key; absent when idle
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
| `/holy-padel/pause`      | `""`        | Toggle pause ↔ resume on the live match       |
| `/holy-padel/start-last` | `""`        | From idle: start a rematch of the last lineup |
| `/holy-padel/stop`       | `""`        | **Stop AND save** the match in its current state |
| `/holy-padel/cancel`     | `""`        | **Discard** the live match — nothing is saved  |
| `/holy-padel/end`        | `""`        | Legacy alias for `stop` (older builds)         |
| `/holy-padel/workout`    | summary JSON| Persist the watch-tracked workout (see below) |

**`/holy-padel/stop` vs `/holy-padel/cancel` — save vs discard.** Court time
routinely runs out mid-match, so *stopping must never lose the score*. `stop`
recomputes the snapshot and always `finishMatch`es: a truly finished match keeps
the engine's winner and final line; a match stopped mid-play is credited to
whoever's ahead (`currentLeader`) so the partial result still counts. `cancel` is
the only path that `deleteMatch`es. Both leave `live`, so the watch's next state
is `phase = "idle"`. This is shared with the phone's END sheet via
`stopAndSaveMatch` (`apps/mobile/src/lib/match-actions.ts`) so the two surfaces
persist identically. `end` remains a back-compat alias for `stop`, and still
backs the **DONE** control on the `won` screen — the user is never stuck on MATCH
WON; DONE persists the finished match and the watch returns to idle.

### Watch → phone: workout summary

Wear OS has no Health Connect, so the watch tracks the match with **Health
Services** (heart rate + calories, `RACQUETBALL` calorie model) and ships the
result to the phone, which is the **single Health Connect writer**. Sent once,
when the live phase ends:

```jsonc
{
  "startedAt": 1783200000000,  // echoes the state payload's startedAt
  "endedAt": 1783204500000,
  "kcal": 412.5,
  "avgBpm": 132,
  "maxBpm": 171,
  "samples": [ { "t": 1783200015000, "bpm": 120 } ]  // one per ~15s
}
```

The phone writes `ExerciseSessionRecord` + `HeartRateRecord` + `TotalCaloriesBurnedRecord`
with `Device.TYPE_WATCH` provenance and the same deterministic
`clientRecordId` as the manual "LOG WORKOUT" path but a **higher
`clientRecordVersion`** — watch data replaces a bare manual log, never
duplicates it. On Apple Watch this path is unused: the watch runs its own
`HKWorkoutSession` and saves straight to Health.

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

## Transport resilience — keep it local, sync in the background

A watch tap must never be lost and must never block the UI on the round-trip:

- **Instant local feedback.** Every tap fires a haptic immediately. The visible
  score, however, still comes from the phone's *next* state push (instant on real
  devices) — the watch has no scoring engine and never computes score locally.
- **Immediate channel + guaranteed fallback.** Each intent is sent on the
  immediate channel when the phone is reachable *and* falls back to the
  queued/background-tolerant channel when it is not, so intents flush
  automatically on reconnect. On Apple Watch that is `sendMessage` (reachable) →
  `transferUserInfo` (queued, survives the phone being asleep); on Wear OS the
  `MessageClient` send is retried against connected nodes.
- **Latest-wins self-heals.** State is latest-wins and the phone re-pushes on
  every change and every 30 s, so a reconnect converges the watch to the truth
  even if an intermediate push was missed — no event replay is needed.
