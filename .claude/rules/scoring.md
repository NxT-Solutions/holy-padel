---
paths:
  - "packages/scoring/**"
  - "packages/scoring-swift/**"
  - "packages/scoring-kotlin/**"
  - "packages/scoring/vectors/**"
  - "docs/fip-scoring-spec.md"
---

# Scoring engine — rule

The [FIP Rules of Padel](../../design/FIP_Rules-of-Padel.pdf) plus
[docs/fip-scoring-spec.md](../../docs/fip-scoring-spec.md) are the **leading source of
truth** for all scoring behaviour. When the code and the rulebook disagree, the rulebook
wins — fix the code, don't bend the spec to match.

## The engine is pure and event-sourced

- A match is its `MatchConfig` + an append-only `PointEvent[]`. `computeMatch(config, events)`
  folds events into a `MatchSnapshot`. `computeStats` and `statusLabel` derive from that fold.
- **No I/O, no hidden state.** Nothing is stored denormalised. Every stat is recomputed.
- **Undo = drop the last event**, nothing more. Don't add mutation paths or reverse-operations.

## When you change scoring behaviour

Do all four, in order:

1. Run GitNexus `impact({target: "<symbol>", direction: "upstream"})` **before** editing any
   engine symbol; report the blast radius. Never proceed past a HIGH/CRITICAL warning silently.
2. Update [docs/fip-scoring-spec.md](../../docs/fip-scoring-spec.md) to match the new behaviour.
3. Regenerate the golden vectors:
   `node packages/scoring/scripts/write-vectors.ts`.
   `packages/scoring/vectors/golden.json` is **generated** (and Biome-excluded) — never hand-edit it.
4. Keep the ports byte-identical: **972/972** vectors must pass.
   - Swift: `(cd packages/scoring-swift && swift test)`
   - Kotlin: `(cd packages/scoring-kotlin && ./gradlew test)` — needs JDK ≤ 23.

`engine-ports.yml` gates parity but is **not a required check** — verify both ports locally
before you push. A green `quality` job does not mean the ports still match.

## Verify

- `pnpm --filter @holy-padel/scoring test` for the TS engine (vitest + property tests).
- `pnpm check` before a PR (Biome + tsc + tests across all packages).
- Biome is `preset: "all"` + nursery. Autofix a file with
  `pnpm exec biome check --write <file>`.
