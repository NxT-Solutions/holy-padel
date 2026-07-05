---
argument-hint: <module-name>
---

Scaffold a local Expo native module named `$ARGUMENTS` at `apps/mobile/modules/$ARGUMENTS`.

A local Expo module needs **all three** parts of the triad, or iOS silently drops the
module at build time while Android looks green — the failure is invisible until you call
into a module that isn't there. Do not skip a step because the module "builds fine."

## The template

Copy `apps/mobile/modules/watch-bridge` exactly — it is the canonical, working shape
(`health-log` is the other existing module). Match its `package.json`, its Expo module
config, and its `ios/` + `android/` native source layout. Rename `watch-bridge` →
`$ARGUMENTS` in the copied `package.json` `name` and update the `description`.

## The triad

1. **`apps/mobile/modules/$ARGUMENTS/package.json`** — mirror
   `apps/mobile/modules/watch-bridge/package.json`: `"name": "$ARGUMENTS"`, `"private": true`,
   a one-line `description`. Keep the same version/field shape.

2. **A `link:` dependency in `apps/mobile/package.json`.** Add
   `"$ARGUMENTS": "link:./modules/$ARGUMENTS"` under `dependencies` (this is exactly how
   `watch-bridge` and `health-log` are wired). Then `pnpm install` from the repo root.

3. **A `.gitignore` negation for the native dirs.** The root `.gitignore` blanket-ignores
   `ios/` and `android/`, then re-includes local module native source with a wildcard glob:
   `!apps/mobile/modules/*/ios/**` and `!apps/mobile/modules/*/android/**`. That glob already
   covers any new module — but **verify**: run `git status apps/mobile/modules/$ARGUMENTS`
   and confirm the `ios/` and `android/` sources show as tracked. If they don't, the module
   compiles locally and dies in CI/on-device iOS. Only add explicit negation lines if the
   wildcard somehow misses your dirs.

## Conventions

Keep the module web-safe (a no-op fallback like `watch-bridge`) so the Expo web build and
Playwright `e2e` still run. TypeScript strict + `exactOptionalPropertyTypes`: omit optional
keys, never set them to `undefined`. Native `ios/`/`android/` dirs under `modules/` are
Biome-excluded — the JS/TS bridge surface is not, so `pnpm exec biome check --write` it.

## Commit

`pnpm install` rewrites the lockfile and may append an approval to
`minimumReleaseAgeExclude` in `pnpm-workspace.yaml`. Commit **`pnpm-workspace.yaml` +
`pnpm-lock.yaml` together** or CI fails. Gitmoji micro-commits, one logical change each;
branch off `main` and open a PR.

## Verify

- `pnpm install` — links the module, updates the lockfile.
- `pnpm check` — Biome + typecheck + tests across all packages.
- Native compiles gate this: `compile-ios`, `compile-android`, and `watch-bridge` are
  **not** required checks. For this native-touching PR, do **not** let auto-merge land
  before those jobs report — merge manually once they are green.
- Building on-device (macOS) is in the **`ios-build-run` skill**
  (`.claude/skills/ios-build-run/SKILL.md`); Android: `pnpm --filter @holy-padel/mobile android`.

Before editing any existing symbol you touch, run `impact({target, direction: "upstream"})`;
run `detect_changes()` before committing.
