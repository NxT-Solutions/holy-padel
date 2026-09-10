# Squash scoring — engine specification

The squash engine is the second scoring mode of `packages/scoring`, sharing the
event-sourced core (`computeMatch(config, events)` → `MatchSnapshot`) with padel
and pickleball. It implements the two scoring systems that clubs actually play:

- **PAR** (point-a-rally), the WSF standard: every rally scores for its winner.
- **HI-HO** (hand-in/hand-out, "English"), the traditional system: only the
  server scores; when the receiver wins a rally it is a **hand-out** — the serve
  changes hands and no point is awarded. HI-HO is supported at any target,
  including the modern **HI-HO to 11**.

Rules reference: [WSF Rules of Squash](https://www.worldsquash.org/rules-of-squash-2/)
(scoring, service and correct-score sections). In-app configuration is a subset;
where implementation choices exist they are called out below.

## 1. Config

```ts
{
  sport: "squash",
  bestOf: 1 | 3 | 5,
  squashMode: "par" | "hiho",
  squashTarget: number,            // 9 / 11 / 15 in the setup UI
  squashTiebreak: "winByTwo" | "setOne" | "setTwo" | "choice",
  squashServeBoxes?: "right" | "left" | "player",   // default "right"
  squashServeBoxA?: "right" | "left",               // when mode is "player"
  squashServeBoxB?: "right" | "left",
  firstServe: "A" | "B",
  firstServePending?: boolean,
}
```

`deuceMode`/`thirdSet` are padel-only and are fixed to inert values
(`"advantage"`/`"fullSet"`) for squash rows.

### Data-model note: a game is stored as a "set"

The engine's `SetSummary` is the unit of match completion. For squash, **one
game is one `SetSummary`** (`kind: "set"`, `games` holds the two point totals),
so `completedSets` is the list of completed games and `setNumber` is the
current game number. Score lines read `"9-7 · 9-5 · 9-11 · 9-7"`. Stats that
walk sets (`computeStats`, `computeGameSeries`) apply unchanged. The UI always
labels these as **GAME**, never "set".

## 2. Games

`rules.squashGameWon` decides a game:

| `squashTiebreak` | Game is won when |
| --- | --- |
| `winByTwo` | winner ≥ target **and** margin ≥ 2 |
| `setOne` | winner ≥ target (sudden death at target−1 all) |
| `setTwo` | winner ≥ target + 1 |
| `choice` | the decision attached to the choice-point rally selects `setOne` or `setTwo` (see §4) |

The setup UI offers `winByTwo` (and `choice` for HI-HO); `setOne`/`setTwo` are
fully supported by the engine, DB and vectors for completeness, and can be set
through saved defaults/config tooling.

After a game:

- `gameServer` becomes the game's winner (the winner serves first in the next
  game — squash's "winner serves" convention);
- `serverConsecutivePoints` resets, so the new hand starts from its preferred
  box (see §5);
- the match ends when a team holds `setsToWin(bestOf)` games (1 / 2 / 3).

## 3. PAR vs HI-HO

`applySquashPoint` (`packages/scoring/src/sports.ts`) folds:

- **PAR** — the rally winner always gains a point. `gameServer` tracks the rally
  winner (serve follows the winner), and `serverConsecutivePoints` counts how
  many points the current hand has served this term.
- **HI-HO** — only a rally won by `gameServer` gains a point. A rally won by the
  receiver awards nothing, flips `gameServer`, and resets
  `serverConsecutivePoints` (a hand-out). The returner's won rallies are the
  app's "longest run" stat rather than points.

Both modes share the game/moment/serve-box derivation, so undo, resume and the
watch replay one code path.

## 4. Interactive tie-break ("choice")

At **target−1 all** (e.g. 8-8 to 9, 10-10 to 11) with
`squashTiebreak: "choice"`, the receiver decides:

- **short / set one** — the game continues to the target;
- **long / set two** — the game continues to target + 1.

Mechanics:

- The decision is **staged** (phone sheet or watch SHORT/LONG buttons →
  `pendingGameSet`) and **rides on the next rally** as `event.gameSet`
  (`"one"`/`"two"`), so undo and resume re-ask naturally: dropping the decided
  rally returns to the choice point.
- The engine refuses to score while the choice is unstaged (the DB
  `scorePoint` guard returns early while `moment.kind === "setChoice"`).
- Defensively, a choice-point rally that arrives with no `gameSet` defaults to
  `"one"` in the fold. This path is not reachable through the app's UI or the
  watch contract.
- The choice is presented to the **receiving side** (the app's convention); the
  engine itself records whichever decision arrives from either surface, so a
  referee-decided game can be entered from either phone or watch.

## 5. Serve boxes

`servingSideOf` (`packages/scoring/src/snapshot.ts`) reports the box the server
serves from:

- the **first point of each hand** starts from the configured box:
  - `"right"`/`"left"` — that box every hand;
  - `"player"` — the serving team's saved preference
    (`squashServeBoxA`/`B`, default right; set from a player's profile side);
- the box then **alternates every point while the same hand serves**
  (`serverConsecutivePoints` parity), matching squash's rule that a server who
  keeps winning swaps boxes.

Because a hand-out resets `serverConsecutivePoints`, the incoming server starts
from their own preferred box.

## 6. Moments and labels

`deriveMoment` produces, for squash: `normal`, `gamePoint`, `matchPoint`, and
`setChoice`. There is no `setPoint`. The live status pill renders these as
**GAME BALL** / **MATCH BALL** for squash (padel keeps "GAME POINT"/"MATCH
POINT"), in `labels.ts`.

## 7. Stats

`computeStats` works unchanged because each game is a completing "set":

- per-game durations and a per-game score list;
- `longestRun` — the longest streak of consecutive rallies won by one team
  (the squash analogue of "service games held", which is meaningless in PAR);
- `computeGameSeries` marks **hand-outs** on each rally so the score-race chart
  separates serve stretches from score runs.

## 8. Mapping to match setup

| Setup option | Engine config |
| --- | --- |
| PAR / HIHO | `squashMode` |
| Target: 9 / 11 / 15 | `squashTarget` |
| Tiebreak: Win by 2 | `squashTiebreak: "winByTwo"` |
| Tiebreak: Ask at N−1 (HI-HO only) | `squashTiebreak: "choice"` |
| First serve box: Right / Left / Auto | `squashServeBoxes` (+ `squashServeBoxA/B`) |
| Games: 1 / 3 / 5 | `bestOf` |
| Format: Singles / Doubles | UI only; squash records no per-partner serve order |

## 9. Out of scope

- **Doubles serve rotation between partners** (hardball doubles alternates
  partners within a hand). The engine tracks the serving *team* only; doubles
  squash is recorded as a team game with one server identity.
- **Lets, strokes, conduct penalties** — no engine events; a replayed rally is
  simply not recorded.
- **RAM scoring** (three-minute games) is not implemented.

## 10. Parity and tests

Squash shares the golden-vector contract: the TS engine generates
`packages/scoring/vectors/golden.json`, and the Swift/Kotlin ports must
reproduce every snapshot exactly. The vector suite covers PAR and HI-HO across
targets, best-of, first serve, **serve-box configurations**, and the
**`choice` tie-break with per-rally `gameSet` decisions**; `winners` plus the
optional `gameSets` string encode each vector compactly.

TS-only unit coverage lives in `packages/scoring/test/sports-edges.test.ts`
(choice long/short, undo re-ask, serve boxes, HI-HO hand-outs) and
`test/stats.test.ts` (`longestRun`). When behavior changes: update this file,
regenerate the vectors (`node packages/scoring/scripts/write-vectors.ts`), and
run the engine ports.
