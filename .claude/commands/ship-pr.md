---
argument-hint: <pr-title>
---

Ship the current work as gitmoji micro-commits on a branch and open a PR titled **$ARGUMENTS**.
For native-touching PRs, wait for the non-required native + engine-port jobs to go green, then merge **manually** — never auto-merge before they report.

Working tree:
!`git status --short`

Current branch:
!`git rev-parse --abbrev-ref HEAD`

## 1. Branch off `main`

`main` is protected — never commit onto it. If the current branch is `main`, cut a fresh branch (kebab-case, scoped to the change, e.g. `watch/stop-intent`). If already on a feature branch, stay on it.

## 2. Commit as gitmoji micro-commits

One logical change per commit — split unrelated edits into separate commits. Each subject starts with a gitmoji, matching the style in `git log`. Before staging, run `detect_changes()` and confirm the touched symbols and execution flows are exactly what this change intends; investigate anything unexpected before committing.

## 3. Verify locally before pushing

Run these and do not push on failure:

```sh
pnpm install
pnpm check                                   # biome + tsc + vitest/property tests, all packages
pnpm --filter @holy-padel/mobile e2e         # Playwright vs the Expo web build
```

If you touched the scoring engine, regenerate golden vectors and re-run the ports so `engine-ports` stays byte-identical:

```sh
node packages/scoring/scripts/write-vectors.ts   # regen packages/scoring/vectors/golden.json
(cd packages/scoring-swift && swift test)
(cd packages/scoring-kotlin && ./gradlew test)                       # needs JDK <= 23
```

If `pnpm install` appended an approval to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml`, stage that file with the lockfile or CI fails.

## 4. Push and open the PR

Push the branch, then:

```sh
gh pr create --base main --title "$ARGUMENTS" --fill
```

## 5. Watch the checks

Required checks that must pass: **quality**, **e2e**, **web-build**.

```sh
gh pr checks --watch
```

**A PR is native-touching if it changes any of:** `apps/mobile/targets`, `apps/mobile/modules`, `apps/watch-wear`, `packages/scoring-swift`, `packages/scoring-kotlin`, `packages/scoring/vectors`, or anything that feeds the engine ports.

For those PRs the native + engine-port jobs are **not required checks** and will not block merge — but they can break `main` (a wrong androidx signature once did). So do **not** enable auto-merge and do **not** merge until these have reported green:

- `watchos`, `watch-wear`, `watch-bridge`
- `compile-ios`, `compile-android`
- `native-e2e`
- `engine-ports` (`swift-vectors` / `kotlin-vectors`)

```sh
gh pr checks   # confirm the native + engine-port jobs are green, not just the required three
```

## 6. Merge — only with confirmation

Do **not** merge on your own. Once the required checks pass (and, for native PRs, the native + engine-port jobs are green too), report the check status and ask before merging manually.
