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

## Fast path: rebuild ONLY the watch app (~1 min, no pods)

When you've only touched watchOS Swift (`apps/mobile/targets/watch/**`), a full
`expo run:ios` is overkill — it rebuilds every RN pod. Rebuild just the watch
target instead. This is the exact sequence used to ship the sideways-tabs UI:

```sh
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
cd apps/mobile

# Propagate your targets/watch edits into ios/ (regenerates the target via
# @bacons/apple-targets; --no-install skips CocoaPods so it's fast):
npx expo prebuild -p ios --no-install

# Build ONLY the watch target FROM THE .xcodeproj. Do NOT use -workspace/-scheme
# (that pulls in all the RN pods + Hermes and rebuilds the phone app):
xcodebuild -project ios/HolyPadel.xcodeproj -target HolyPadelWatch \
  -configuration Debug -sdk watchsimulator CODE_SIGNING_ALLOWED=NO build
echo "xcodebuild exit: $?"          # capture BEFORE any pipe — see the gotcha below

# Product lands PROJECT-RELATIVE, not in ~/Library/Developer/Xcode/DerivedData:
APP=ios/build/Debug-watchsimulator/HolyPadelWatch.app

WATCH=<watch-udid>                  # xcrun simctl list devices booted
xcrun simctl terminate "$WATCH" com.holypadel.app.watchkitapp 2>/dev/null  # or the old binary keeps running
xcrun simctl install   "$WATCH" "$APP"
xcrun simctl launch    "$WATCH" com.holypadel.app.watchkitapp
xcrun simctl io "$WATCH" screenshot /tmp/watch.png    # verify what actually rendered
```

- **The watch UI only shows a live match when the phone pushes one.** A standalone
  watch launch shows "NO LIVE MATCH" (the idle screen) — the paged live scoreboard
  and the controls tab only render in the `.live` phase. To see them, run the phone
  app with a live match in its DB (the seed has `seed-live`); its `WatchSync` pushes
  state over WatchConnectivity.
- Watch bundle id is `com.holypadel.app.watchkitapp` (phone id `com.holypadel.app` + the target's `.watchkitapp`).

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
- `xcrun simctl ...` fails with **exit code 72** / "unable to find utility simctl" → same as above: `simctl` lives only in full Xcode, so `DEVELOPER_DIR` must be exported (prereq 1).
- `xcodebuild: error: The flag -scheme, -testProductsPath, or -xctestrun is required when specifying -derivedDataPath` → you combined `-derivedDataPath` with `-target`; they're mutually exclusive. Drop `-derivedDataPath` (the watch product then lands in `apps/mobile/ios/build/Debug-watchsimulator/`).
- **`xcodebuild ... | tail` masks the real exit code** — the pipe reports `tail`'s status, so a failed build looks like it "succeeded". Capture `$?` straight after `xcodebuild` (or write to a log and `grep -c "BUILD SUCCEEDED"`).
- Fresh watch build but the sim still shows the old UI → you didn't `simctl terminate` before `install`+`launch` (the running process holds the old binary), OR you found a stale `HolyPadelWatch.app` in `~/Library/.../DerivedData` instead of the project-relative `ios/build/…` one.
- `pod: command not found` → prereq 2.
- Real Swift/Kotlin compile errors → read them; the native sources live in `apps/mobile/targets/watch` (watchOS), `apps/mobile/modules/*/ios|android` (native modules), `apps/watch-wear` (Wear OS).
- `prebuild` rewrites `apps/mobile/package.json` scripts (`android`/`ios` → `expo run:*`) and creates the git-ignored `ios/` dir — expected; don't commit the script churn.
