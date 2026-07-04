# Holy Padel

[![CI](https://github.com/NxT-Solutions/holy-padel/actions/workflows/ci.yml/badge.svg)](https://github.com/NxT-Solutions/holy-padel/actions/workflows/ci.yml)

Padel score tracker — every point, game and set on your phone, stored locally.

Implements the **Padel Score Tracker** design (see [`design/`](design)) on top of the
official [FIP Rules of Padel](design/FIP_Rules-of-Padel.pdf): sets to 6 games,
tie-break at 6–6, advantage or golden-point deuce, optional super tie-break third set.

Ships with **Apple Watch and Wear OS companions** that mirror the live match and
score it from your wrist — see [Watch apps](#watch-apps).

## Stack

- **Turborepo** + pnpm workspaces
- **TypeScript** (strict) everywhere
- **Expo / React Native** app in [`apps/mobile`](apps/mobile)
- **Tamagui** for components and styling
- **SQLite** (`expo-sqlite`) — matches never leave the phone
- **BiomeJS** for linting and formatting, maximum strictness
- **Wear OS** companion in [`apps/watch-wear`](apps/watch-wear) — Kotlin + Jetpack Compose
- **watchOS** companion in [`apps/mobile/targets/watch`](apps/mobile/targets/watch) — SwiftUI, via `@bacons/apple-targets`

## Layout

| Path                        | What                                                    |
| --------------------------- | ------------------------------------------------------- |
| `apps/mobile`               | Expo app — screens, navigation, SQLite adapter          |
| `apps/mobile/targets/watch` | Apple Watch app — SwiftUI, WatchConnectivity            |
| `apps/watch-wear`           | Wear OS app — Kotlin + Compose, Wearable Data Layer     |
| `packages/scoring`          | Pure FIP-rules match engine (event-sourced, undoable)   |
| `packages/db`               | Schema, migrations and typed repositories over SQLite   |
| `docs/watch-sync.md`        | Phone ↔ watch sync contract (shared by both watches)    |
| `design/`                   | Source design file + official rules PDF                 |

## Commands

```sh
pnpm install
pnpm dev        # expo dev server (press i / a, or open the web preview)
pnpm check      # biome + typecheck + unit/property tests, everywhere
pnpm --filter @holy-padel/mobile e2e   # 59 Playwright specs against the web build
```

## Testing

Four layers, all runnable locally:

- **Engine units** (`packages/scoring/test`) — 62 tests citing FIP rule numbers:
  game modes, 7-5 sets, tie-break rotation and serve handoff, super tie-break,
  star point boundaries, plus fast-check **property invariants** over hundreds of
  random matches (undo is always exact, set scores always legal, no play after
  the final point).
- **DB units** (`packages/db/test`) — repositories on `node:sqlite`, including
  the guard that refuses point events on finished matches.
- **App units** (`apps/mobile/test`) — the seed replays to the design's exact
  numbers; formatter contracts.
- **E2E** (`apps/mobile/e2e`) — 59 Playwright specs, each in a fresh browser
  context (fresh OPFS ⇒ the exact seeded database): every screen and flow,
  full matches of every format, undo across game/set/tie-break boundaries,
  rematch chains, twin live matches, the empty ledger, picker edges,
  double-tap guards, and the deep-link/reload navigation regressions.
- **Native E2E** (`apps/mobile/.maestro`) — Maestro flows on a real
  simulator/emulator for the shell behaviour the web build can't exercise:
  OS alert dialogs, cold-start persistence across process death, native tab and
  back navigation, and the picker with the on-screen keyboard.

### Running the native flows

They need the app on a device. Locally, with a booted emulator/simulator and a
dev build (`npx expo run:android` or `run:ios`) plus
[Maestro](https://maestro.mobile.dev) installed:

```sh
pnpm --filter @holy-padel/mobile e2e:native
```

In CI, the `native-e2e` workflow prebuilds a release APK and runs all six flows
on an Android emulator (green in ~3 min of device time). It runs on merges to
`main`, on demand, and on PRs tagged `native-e2e`. It's kept off the required
set to spare every PR the ~20-minute Android build; promote `maestro-android`
to the `protect-main` required checks if you want it gating merges.

First launch seeds the design's demo ledger (players, twelve finished matches and
the live one from the home screen) — all stored as real point events and replayed
through the engine, so every stat on screen is computed, not mocked.

## How scoring works

A match is its `MatchConfig` plus an append-only list of point events. The engine
(`computeMatch`) folds events into a snapshot — points, games, sets, serving pair,
and the "moment" (game/set/match point, deuce, advantage, golden point, tie-break)
that drives the live status pill. Undo removes the last event; resume replays the
list. `computeStats` derives the overview screen: breaks, service games held,
longest game, per-set durations.

## Watch apps

The design's watch screens (3g/3h, 1c–1e) ship as **two native companions**, one
per platform. Both are thin mirrors of the phone: they render the live match and
send `score` / `undo` / `start-last` intents back, but run **no scoring engine** —
so the FIP rules keep exactly one implementation, on the phone. The phone stays
the single source of truth (its SQLite ledger + `@holy-padel/scoring`). The shared
JSON payload contract is [`docs/watch-sync.md`](docs/watch-sync.md).

| Watch         | Where                            | Stack                     | Transport                                                                   |
| ------------- | -------------------------------- | ------------------------- | --------------------------------------------------------------------------- |
| **Wear OS**   | [`apps/watch-wear`](apps/watch-wear)                     | Kotlin + Jetpack Compose  | Wearable Data Layer — `DataClient` (state), `MessageClient` (intents)       |
| **Apple Watch** | [`apps/mobile/targets/watch`](apps/mobile/targets/watch) | SwiftUI                   | WatchConnectivity — `updateApplicationContext` (state), `sendMessage`/`transferUserInfo` (intents) |

The Apple Watch target is generated into the iOS project by
[`@bacons/apple-targets`](https://github.com/EvanBacon/expo-apple-targets) during
`expo prebuild`, so it lives in the monorepo and survives regeneration. Both are
**compiled on every change in CI** (see [CI](#ci)).

The phone drives both from one place: `apps/mobile/src/watch` builds the state
payload and applies incoming intents (unit-tested), and the native
[`WatchBridge`](apps/mobile/modules/watch-bridge) Expo module carries them over
WatchConnectivity / the Wearable Data Layer. Every layer is compiled in CI; only
end-to-end Bluetooth pairing needs physical devices.

## CI

Seven workflows in [`.github/workflows`](.github/workflows), all on GitHub-hosted runners:

| Workflow        | Runs                                                    | Required? |
| --------------- | ------------------------------------------------------- | --------- |
| `ci`            | Biome, typecheck, unit + property tests, web build      | ✅ `quality`, `web-build` |
| `ci` (`e2e`)    | 59 Playwright specs against the Expo web build          | ✅ `e2e`  |
| `native-e2e`    | Maestro flows on an Android emulator (real device shell)| on demand / `main` / label |
| `watch-wear`    | Gradle `assembleDebug` of the Wear OS app               | on watch changes |
| `watchos`       | Unsigned `watchsimulator` build of the Apple Watch app (macos-26) | on watch changes |
| `watch-bridge`  | Compiles the phone-side `WatchBridge` module — Kotlin + Swift | on bridge changes |
| `dependabot`    | Grouped dependency PRs                                   | —         |

`main` is protected by the `protect-main` ruleset: PRs required, `quality` / `e2e`
/ `web-build` must pass and be up to date, no force-push or deletion. The heavier
device/watch builds are kept off the required set so they don't gate every PR;
promote them if you want them blocking merges.

## Notes

- `patches/expo-sqlite@57.0.0.patch` fixes an upstream bug in expo-sqlite's web
  sync bridge: the worker wrote the result length through a `Uint8Array.set`,
  truncating it to one byte, so any query result over 255 bytes failed with
  "Unexpected end of JSON input". Worth an upstream PR.
- `apps/mobile/metro.config.js` serves the sqlite wasm asset and sets the
  cross-origin-isolation headers the web build needs.
