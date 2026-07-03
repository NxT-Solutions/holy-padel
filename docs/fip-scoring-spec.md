# Padel scoring — engine specification

Distilled from the official **FIP Rules of Padel** ([PDF](../design/FIP_Rules-of-Padel.pdf),
23 pages; scoring is "RULE 1. SCORE IN A GAME" plus Rules 2–10 for serve/side mechanics).
These rules are leading for `packages/scoring`.

## 1. Point scoring within a game (Rule 1 — Score)

All modes use the 0 / 15 / 30 / 40 call sequence. The rulebook defines **three official
game-scoring options**; the engine supports all three.

### Option 1 — Advantage (traditional)

15, 30, 40, game. At three points each: *deuce*. Next point won: *advantage*; the same
pair winning the following point wins the game, otherwise back to deuce. Unlimited
cycles — a game needs two consecutive points from deuce.

### Option 2 — Star Point (two advantage cycles, then deciding point)

Deuce 1 → advantage 1 → (lost) deuce 2 → advantage 2 → (lost) deuce 3, then a single
deciding **Star Point**. The receiving pair chooses whether to receive on the right or
left side; receivers cannot swap positions. (Mixed matches: receiver must be the same
sex as the server.)

### Option 3 — Golden Point (no-advantage)

At the **first** deuce (3 points each) a single deciding **golden point** is played.
The receiving pair chooses right or left service box; receivers cannot swap positions.
Winner of the point wins the game. (The rulebook's "wins the match" wording is a typo —
the parallel Star Point clause confirms it means the game.)

## 2. Games, sets, match (Rule 1, Score, pts 2–4)

- First pair to **6 games with a 2-game margin** wins the set (6-0 … 6-4).
- At **5-5** two more games are played → **7-5** is a valid set score.
- At **6-6** a tie-break decides the set, recorded **7-6**.
- Match is **best of three sets**.
- Pre-agreed variant: third set **without tie-break** — at 6-6 play continues until a
  pair leads by two games (8-6, 9-7, …).

## 3. Tie-break (Rule 1 — Tie-break)

- Points are called numerically: zero, 1, 2, 3 …
- Won by the first pair to **7 points with a 2-point margin**; continues unbounded
  until the margin is obtained.
- **Serve rotation**: started by the player whose turn it is in the set's order — this
  player serves **one point from the right**. Then the next server (opposing pair, per
  rotation) serves **two points starting from the left**, and thereafter every server
  in rotation serves **two consecutive points** (pattern 1, 2, 2, 2, …).
- Ends change **every 6 points** (Rule 5.2); no rest on those changes (Rule 2.5/2.10).
- The **following set is started by the pair who did not begin serving** in the
  tie-break (which of the two players is their choice, Rule 6.8).

## 4. Alternative score methods (Rule 1 — Alternative Score Methods)

- **Four-game / mini set**: set to 4 games, 2-game margin, tie-break at 4-4.
- **Match tie-break to 7**: at one set all, a tie-break to 7 (2 clear) replaces the
  third set and decides the match.
- **Super tie-break to 10**: at one set all, a tie-break to **10 points (2 clear)**
  replaces the third set and decides the match. Serve/ends mechanics follow §3.

## 5. Serve order and sides

- **Toss** (Rule 4.1): coin flip; winner picks serve/receive, side, or defers.
- **Within a pair** (Rule 6.8): before each set the pair chooses which player serves
  first; the four-player order is then fixed for that set. Teams alternate service
  games; a team's two players alternate that team's games.
- **Serving side per point** (Rule 6.5): first point of a game from the **right**,
  then alternating left/right each point (deciding points in §1 let receivers choose).
- **Receiving order** (Rule 8.2–8.3): receiving pair fixes who receives first for the
  whole set; receivers alternate points within a game.

## 6. Change of ends (Rule 5)

- After the 1st, 3rd and every subsequent **odd** game of each set.
- During a tie-break: **every 6 points**.
- Errors are corrected on discovery; points already played stand.

## 7. State-relevant extras

- **Double fault** loses the point (Rule 13.1.q) — the engine keeps score per rally
  outcome only; faults are not tracked.
- **Resumption** (Rule 2.12): a suspended match resumes exactly where it stopped —
  game, score, server, ends and order preserved (why the app event-sources the match).
- Lets/interference replay the point — no score change, no engine event.

## Mapping to the app's match setup (design 1f)

| Setup option              | Engine config                                              |
| ------------------------- | ---------------------------------------------------------- |
| Sets: 1 / 3               | `bestOf: 1 \| 3`                                           |
| Third set: Full set       | third set is a normal set (tie-break at 6-6)               |
| Third set: Super TB       | at one set all, super tie-break to 10 replaces the 3rd set |
| At deuce: Advantage       | game mode Option 1                                         |
| At deuce: Golden pt       | game mode Option 3 (Option 2 "star point" also available)  |
| First serve: Team A / B   | which team serves game 1                                   |
