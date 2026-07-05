---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeScript — rule

TypeScript **strict** with `exactOptionalPropertyTypes` on across the monorepo.

## Optional keys: omit, never `undefined`

Under `exactOptionalPropertyTypes` an optional key is **absent**, not set to
`undefined`. Omit it. The `courtField` spread pattern in
`apps/mobile/src/watch/build-state.ts` is the reference:

```ts
function courtField(match: MatchSummary): { court?: string } {
  // exactOptionalPropertyTypes: omit the key rather than set it to undefined.
  return match.court === undefined ? {} : { court: match.court };
}
// …spread it: { ...base, ...courtField(match) }
```

## Imports

App code imports via the `@/` alias (mirrored in `vitest.config.ts`); use it
instead of long relative paths. Reach into workspace packages by their published
name — `@holy-padel/scoring`, `@holy-padel/db`.

## Formatting & lint

Biome runs at max strictness (preset `all` + nursery). Match the surrounding
file's style, comment density, and idioms — don't introduce a new one. Autofix a
single file with:

```sh
pnpm exec biome check --write <file>
```

Lint the whole repo with `pnpm lint`; `pnpm check` runs Biome + `tsc` + tests
across all packages. `apps/mobile/targets` and `apps/mobile/modules` (native
dirs) are excluded from Biome, as is the generated
`packages/scoring/vectors/golden.json`.

## Commits

Gitmoji micro-commits, one logical change each. Branch off `main` and open a PR
(`main` is protected).
