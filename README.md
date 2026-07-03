# Holy Padel

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
pnpm dev        # expo dev server
pnpm check      # biome + typecheck + tests, everywhere
```
