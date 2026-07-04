# Holy Padel — Apple Watch

The watchOS companion. SwiftUI, a thin mirror of the phone's live match. It runs
**no scoring engine** — the phone owns the FIP rules and pushes rendered state;
the watch just draws it and sends intents back. See
[`docs/watch-sync.md`](../../../../docs/watch-sync.md) for the shared contract.

## How it's built into the app

This directory is an [`@bacons/apple-targets`](https://github.com/EvanBacon/expo-apple-targets)
target. `expo-target.config.js` declares a `watch`-type target; on
`expo prebuild -p ios` the plugin generates the watch app into the native Xcode
project (bundle id `com.holypadel.app.watchkitapp`, accent from the design lime)
and wires the phone app's "Embed Watch Content" phase. Every file here is linked
into the target, so the app stays a managed Expo app — there is no committed
`ios/` project.

`Assets.xcassets/` (the AppIcon + accent color) is **generated** from the
`icon`/`colors` config on each prebuild and is git-ignored; only the sources here
are checked in.

## How it syncs

Over **WatchConnectivity** (`WatchConnectivityManager`):

- **Phone → watch:** `updateApplicationContext(["state": "<json>"])`, decoded
  into `MatchState` (defensively — a missing field falls back to its default).
- **Watch → phone:** `score` / `undo` / `start-last` go back via `sendMessage`,
  falling back to `transferUserInfo` when the phone is unreachable, using the
  same `{ path, body }` shape as the Wear OS Data Layer paths.

## Layout

| File                            | What                                          |
| ------------------------------- | --------------------------------------------- |
| `expo-target.config.js`         | Target definition (type, bundle id, icon)     |
| `index.swift`                   | `@main` app entry, owns the sync manager      |
| `content.swift`                 | Routes on `phase` → idle / live / won         |
| `Screens.swift`                 | The three screens + shared pieces             |
| `MatchState.swift`              | Mirrored state + resilient JSON decode        |
| `WatchConnectivityManager.swift`| WCSession — state in, intents out             |
| `Theme.swift`                   | Court palette (matches the design)            |

## Building

Compiled on every change by the [`watchos`](../../../../.github/workflows/watchos.yml)
CI workflow on `macos-26`: `expo prebuild -p ios --no-install`, then an unsigned
`watchsimulator` build of the `HolyPadelWatch` target straight from the
`.xcodeproj` (the target has no pods, so it skips the CocoaPods workspace).

Locally: `npx expo prebuild -p ios` from `apps/mobile`, then open
`ios/HolyPadel.xcworkspace` in Xcode and run the `HolyPadelWatch` scheme.
