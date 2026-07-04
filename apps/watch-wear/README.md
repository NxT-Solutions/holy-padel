# Holy Padel — Wear OS

The Android watch companion. Kotlin + Jetpack Compose, a thin mirror of the
phone's live match. It runs **no scoring engine** — the phone owns the FIP rules
and pushes rendered state; the watch just draws it and sends intents back. See
[`docs/watch-sync.md`](../../docs/watch-sync.md) for the shared contract.

## How it syncs

Over the **Wearable Data Layer** (Google Play services):

- **Phone → watch:** a `DataItem` at `/holy-padel/state` carries the match-state
  JSON. `WatchSync` (a `DataClient.OnDataChangedListener`) decodes it into
  `MatchState` and exposes a `StateFlow` the Compose UI collects.
- **Watch → phone:** `score` / `undo` / `start-last` go back as `MessageClient`
  messages to the matching paths.

The watch's `applicationId` **must equal the phone app's** (`com.holypadel.app`)
for the Data Layer to pair them — see `app/build.gradle.kts`.

## Layout

| Path                                   | What                                             |
| -------------------------------------- | ------------------------------------------------ |
| `app/src/main/java/.../MatchState.kt`  | The mirrored state + JSON decode                 |
| `app/src/main/java/.../WatchSync.kt`   | Data Layer client — state in, intents out        |
| `app/src/main/java/.../MainActivity.kt`| Hosts the Compose UI, starts/stops sync          |
| `app/src/main/java/.../ui/`            | `Screens.kt` (idle/live/won), text + colors      |

The UI is drawn with **core Compose** (no `wear.compose`) to keep the dependency
surface small and the build reproducible.

## Building

Compiled on every change by the [`watch-wear`](../../.github/workflows/watch-wear.yml)
CI workflow: `gradle assembleDebug` against `compileSdk 36` (API 36 / Android 16)
with Gradle 9.4.1, AGP 9.2.0 and Kotlin 2.4.0. `androidx.core` is pinned to
`1.18.0` — the newest release that still builds against the stable API 36 (1.19.0
requires API 37).

Locally you need a JDK 17 + the Android SDK (open in Android Studio, or run Gradle
with an `ANDROID_HOME` pointing at platform 36 / build-tools 36.0.0).
