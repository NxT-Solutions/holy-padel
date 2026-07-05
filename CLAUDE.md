# Holy Padel — agent guide

Local-first **padel score tracker**: an Expo/React Native phone app plus **Apple Watch
and Wear OS companions**, with an event-sourced FIP-rules scoring engine. Matches never
leave the device by default. The [FIP Rules of Padel](design/FIP_Rules-of-Padel.pdf) are
the **leading source of truth** for all scoring behaviour — when in doubt, the rulebook wins.

## Monorepo layout (Turborepo + pnpm)

| Path | What |
| --- | --- |
| `packages/scoring` | Pure FIP match engine — `computeMatch(config, events)` folds point events → snapshot; `computeStats`, `watchStatusLabel`. Event-sourced, undoable, no I/O. |
| `packages/db` | SQLite schema + typed repositories (`SqlDriver` interface). Versioned migrations in `schema.ts`. |
| `apps/mobile` | Expo app (expo-router). Screens in `src/app`, watch sync in `src/watch`, health in `src/health`, native modules in `modules/`, watchOS target in `targets/watch`. |
| `apps/watch-wear` | Wear OS app — Kotlin + Jetpack Compose, Wearable Data Layer. |
| `docs/` | `fip-scoring-spec.md` (rules), `watch-sync.md` (phone↔watch contract). |
| `design/` | Source design file + the FIP rules PDF. |

## Core architecture

- **Event sourcing**: a match is its `MatchConfig` + an append-only `PointEvent[]` (each with a timestamp). The engine folds events into a snapshot. Undo = drop the last event. Every stat is computed, never stored denormalised (except a cached final score line).
- **Phone is the single source of truth.** Watches are thin mirrors: they render the pushed state and send back `score`/`undo`/`start-last`/`pause` intents. No scoring logic on the watch. Contract: [docs/watch-sync.md](docs/watch-sync.md). Payload builder: `apps/mobile/src/watch/build-state.ts`; intents: `apps/mobile/src/watch/apply-intent.ts`; native transport: the optional `WatchBridge` module (`modules/watch-bridge`, web-safe no-op).
- **Health/workout**: matches log to Apple Health / Health Connect (free, opt-in, write-only). Live tracking runs a real workout session on the watch (HR/calories); the phone persists the Wear summary. Duration excludes paused breaks via `playedMs()` in `src/lib/format.ts`.
- **Owner** is hard-coded `"nico"` throughout (see the matches screen); use that constant, don't call `getOwner` in new sync code.

## Conventions (do these)

- **TypeScript strict**, `exactOptionalPropertyTypes` on — omit optional keys, never set them to `undefined` (see the `courtField` spread pattern in `build-state.ts`).
- **Biome** at max strictness (`preset: "all"` + nursery). Run `pnpm lint`; auto-fix formatting with `pnpm exec biome check --write <file>`. `apps/mobile/targets` and `apps/mobile/modules` native dirs are excluded.
- **Gitmoji micro-commits**, one logical change each. Branch off `main`; open a PR (main is protected — see below). Never commit/push unless asked.
- Match the surrounding file's style, comment density, and idioms. App code imports via the `@/` alias (mirrored in `vitest.config.ts`).

## Verify before pushing

```sh
pnpm install
pnpm check                                   # biome + typecheck + unit/property tests, all packages
pnpm --filter @holy-padel/mobile e2e         # Playwright specs vs the Expo web build
```
Per package: `pnpm --filter @holy-padel/db test`, etc. Unit tests use `vitest`; the DB tests run on `node:sqlite` via `test/memory-driver.ts`.

## Building & running natively

**This is a dev-client app — Expo Go cannot run it** (custom native modules + a watch target). See the **`ios-build-run` skill** in `.claude/skills/` for the full recipe. In short, on this machine:

```sh
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer   # full Xcode, no sudo
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8                        # or CocoaPods crashes (ASCII-8BIT)
cd apps/mobile && npx expo run:ios --device "<iPhone UDID>"       # prebuild + pods + build + Metro
```
CocoaPods must be present (`brew install cocoapods` — the system Ruby 2.6 is too old). For the watch app, pair the sims first: `xcrun simctl pair <watch-udid> <iphone-udid>`. Android: `pnpm --filter @holy-padel/mobile android`.

## CI & branch protection

Six workflows in `.github/workflows` (see the README's CI table). `main` is protected by the `protect-main` ruleset: PRs required; `quality` / `e2e` / `web-build` must pass and be up to date. **Native compiles (`watch-wear`, `watchos`, `compile-android`/`compile-ios`, `native-e2e`) are NOT required checks** — so for native-touching PRs, don't let auto-merge land before the native jobs report; merge manually once they're green (a wrong androidx signature once broke `main`).

## Gotchas that have bitten us (read `~/.claude` memory too)

- **Local Expo modules** need all three: a `package.json`, a `link:` dependency in the app, and `.gitignore` negation for their native dirs — or iOS silently drops the module while Android looks green. Copy `modules/watch-bridge` exactly.
- **androidx APIs**: verify signatures against the pinned **release AAR** (`javap` on the downloaded `.aar`), never androidx-main source (it's ahead of releases).
- **`androidx.core`** is pinned to 1.18.0 (1.19.0 demands compileSdk 37, absent from the CI SDK repo).
- **pnpm supply-chain gate**: new deps get an approval appended to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml` on local install — commit that file with the lockfile or CI fails.
- **expo-sqlite web patch** in `apps/mobile/patches` fixes a length-truncation bug; keep it until upstream ships.

## Where to look first

- Scoring questions → `packages/scoring/src` + `docs/fip-scoring-spec.md`.
- Watch questions → `docs/watch-sync.md` + `apps/mobile/src/watch` + the two watch apps.
- "How does X render?" → `apps/mobile/src/app` (expo-router screens) + `src/lib/format.ts` (all display strings).
