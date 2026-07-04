# Holy Padel

[![CI](https://github.com/NxT-Solutions/holy-padel/actions/workflows/ci.yml/badge.svg)](https://github.com/NxT-Solutions/holy-padel/actions/workflows/ci.yml)

Padel score tracker — every point, game and set on your phone, stored locally.

Implements the **Padel Score Tracker** design (see [`design/`](design)) on top of the
official [FIP Rules of Padel](design/FIP_Rules-of-Padel.pdf): sets to 6 games,
tie-break at 6–6, advantage or golden-point deuce, optional super tie-break third set.

## Stack

- **Turborepo** + pnpm workspaces
- **TypeScript** (strict) everywhere
- **Expo / React Native** app in [`apps/mobile`](apps/mobile)
- **Tamagui** for components and styling
- **SQLite** (`expo-sqlite`) — matches never leave the phone
- **BiomeJS** for linting and formatting, maximum strictness

## Layout

| Path               | What                                                    |
| ------------------ | ------------------------------------------------------- |
| `apps/mobile`      | Expo app — screens, navigation, SQLite adapter          |
| `packages/scoring` | Pure FIP-rules match engine (event-sourced, undoable)   |
| `packages/db`      | Schema, migrations and typed repositories over SQLite   |
| `design/`          | Source design file + official rules PDF                 |

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

## Notes

- `patches/expo-sqlite@57.0.0.patch` fixes an upstream bug in expo-sqlite's web
  sync bridge: the worker wrote the result length through a `Uint8Array.set`,
  truncating it to one byte, so any query result over 255 bytes failed with
  "Unexpected end of JSON input". Worth an upstream PR.
- `apps/mobile/metro.config.js` serves the sqlite wasm asset and sets the
  cross-origin-isolation headers the web build needs.
- The design's watch screens (3g/3h, 1c–1e) are companion-device surfaces; the
  phone app implements every phone flow. A watchOS/Wear app is out of scope for
  Expo and would be a separate target.
