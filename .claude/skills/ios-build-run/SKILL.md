---
name: ios-build-run
description: >-
  Build and run the Holy Padel Expo app on the local iOS and Apple Watch
  simulators (or Android). Use this WHENEVER the user wants to run the app, test
  on a simulator, make a dev build, install on iPhone/Apple Watch, launch Metro,
  reproduce a native/runtime issue, or asks "why won't Expo Go open this" — this
  is a dev-client app (custom native modules + a watchOS target) so Expo Go does
  NOT work, and the build has three non-obvious prerequisites that fail loudly if
  skipped. Reach for this before running any expo/xcodebuild/simctl command here.
---

# iOS / watch simulator build & run

This app can't run in Expo Go — it has custom native modules (`watch-bridge`,
`health-log`) and an embedded watchOS target, so it needs a **dev build**. Three
prerequisites on this machine trip up a naive `expo run:ios`; set them and it works.

## The three prerequisites (all required)

1. **Point at full Xcode.** `xcode-select -p` returns CommandLineTools (no `xcodebuild`), but `/Applications/Xcode.app` exists. Route to it per-command with an env var — **no sudo**:
   `export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`
2. **CocoaPods** (the system Ruby 2.6 is too old): `brew install cocoapods` once.
3. **A UTF-8 locale**, or CocoaPods dies with `Encoding::CompatibilityError: Unicode Normalization not appropriate for ASCII-8BIT`:
   `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`

## Run on iOS (+ the paired Apple Watch)

```sh
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

xcrun simctl list devices booted                 # grab the booted iPhone + Watch UDIDs
# Pair once so the embedded watch app installs onto the watch sim:
xcrun simctl pair <watch-udid> <iphone-udid>

cd apps/mobile
npx expo run:ios --device <iphone-udid>          # prebuild → pod install → xcodebuild → install → Metro
```

- The first build is **slow** (CocoaPods + Hermes + every RN pod + the watch target) — expect 15–30 min. Rebuilds are incremental.
- A **debug** build needs the Metro bundler running to serve JS — `expo run:ios` keeps it alive in that process. If it isn't running later, `cd apps/mobile && npx expo start` (or re-run the command). For a standalone app that runs without Metro, add `--configuration Release`.
- Prefer targeting by **UDID**, not name — `--device "iPhone 17"` can fuzzy-match "iPhone 17 Pro".
- The watch app installs automatically onto the paired watch sim; open the Watch simulator to see it mirror the live match.

## Run on Android

```sh
pnpm --filter @holy-padel/mobile android          # prebuild + Gradle + install on the running emulator/device
```
The Wear OS app is a separate Gradle project in `apps/watch-wear` (see its README / the `watch-wear` CI workflow to build its APK).

## Expected noise (not errors)

- `[bacons/apple-targets] Expo config is missing required ios.appleTeamId` — **harmless for simulator builds** (no code signing). Only matters for device/EAS builds.
- `hermes-engine has added 1 script phase … inspect before executing` — a CocoaPods notice, not a failure.

## When a build breaks

- `xcodebuild ... error code 65` right after "Installing CocoaPods" / "sandbox is not in sync" → almost always the missing UTF-8 locale (prereq 3). Set it and re-run.
- `xcodebuild requires Xcode` / `xcode-select ... CommandLineTools` → prereq 1 (`DEVELOPER_DIR`) wasn't exported in this shell.
- `pod: command not found` → prereq 2.
- Real Swift/Kotlin compile errors → read them; the native sources live in `apps/mobile/targets/watch` (watchOS), `apps/mobile/modules/*/ios|android` (native modules), `apps/watch-wear` (Wear OS).
- `prebuild` rewrites `apps/mobile/package.json` scripts (`android`/`ios` → `expo run:*`) and creates the git-ignored `ios/` dir — expected; don't commit the script churn.
