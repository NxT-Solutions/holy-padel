---
paths:
  - "apps/mobile/modules/**"
---

# Local Expo modules — rule

A local Expo module needs **all three** of the following, or iOS silently drops the
module while Android looks green — a broken build that CI's required checks won't catch:

1. A `package.json` in the module dir (see `modules/watch-bridge/package.json`).
2. A `link:` dependency in `apps/mobile/package.json`
   (e.g. `"watch-bridge": "link:./modules/watch-bridge"`).
3. A `.gitignore` negation so the native dirs are committed. These live at the repo
   root and already cover every module by glob:
   `!apps/mobile/modules/*/ios/**` and `!apps/mobile/modules/*/android/**`.

**Copy `modules/watch-bridge` exactly** when adding a module. Existing modules:
`watch-bridge`, `health-log`. These dirs are excluded from Biome, so lint won't
guard them for you.

## androidx signatures

Verify androidx APIs against the pinned **release AAR** (`javap` on the downloaded
`.aar`), never androidx-main source — main is ahead of releases and a wrong
signature once broke `main`. `androidx.core` is pinned to **1.18.0** (1.19.0 needs
compileSdk 37, absent from CI).

## Commit the lockfile pair

A new dependency appends an approval to `minimumReleaseAgeExclude` in
`pnpm-workspace.yaml` on local install — commit `pnpm-workspace.yaml` **together
with** `pnpm-lock.yaml`, or CI fails.

## Native CI is not required — merge manually

`watch-bridge`, `compile-ios`, `compile-android`, and the other native jobs are
**not** required checks. On a native-touching PR, do **not** let auto-merge land
before these jobs report — merge manually once they're green.

## Rebuilding natively

The full iOS build recipe and the `simctl` pairing gotchas live in the
`ios-build-run` skill (`.claude/skills/ios-build-run/SKILL.md`). Reference it;
don't duplicate it here. Android: `pnpm --filter @holy-padel/mobile android`.
