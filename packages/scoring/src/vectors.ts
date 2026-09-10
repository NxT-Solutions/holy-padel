import { computeMatch } from "./engine.ts";
import type { MatchConfig, MatchSnapshot, PointEvent } from "./types.ts";

/**
 * Golden test vectors: the canonical TS engine's output for a spread of
 * (config, winner-sequence) inputs, serialised as language-neutral JSON.
 *
 * The Swift (watchOS) and Kotlin (Wear OS) ports of the engine load the committed
 * `vectors/golden.json` and must reproduce every `snapshot` exactly — that's how
 * three implementations of the FIP rules stay in lockstep. `test/vectors.test.ts`
 * asserts the committed file still matches this generator, so the TS engine
 * remains the single source of truth and the vectors can't silently drift.
 */

export interface SerializedSnapshot {
  readonly finished: boolean;
  readonly winner: "A" | "B" | null;
  readonly setNumber: number;
  readonly currentSetGames: { readonly A: number; readonly B: number };
  readonly currentGame:
    | null
    | {
        readonly kind: "standard";
        readonly calls: { readonly A: string; readonly B: string };
        readonly points: { readonly A: number; readonly B: number };
      }
    | {
        readonly kind: "tieBreak";
        readonly tieBreakKind: string;
        readonly target: number;
        readonly points: { readonly A: number; readonly B: number };
      }
    | {
        readonly kind: "squash";
        readonly points: { readonly A: number; readonly B: number };
      }
    | {
        readonly kind: "pickleball";
        readonly points: { readonly A: number; readonly B: number };
        readonly serverNumber: 1 | 2 | null;
      };
  readonly servingTeam?: "A" | "B";
  readonly servingSide?: "right" | "left";
  readonly moment: Record<string, unknown>;
  readonly totalGames: { readonly A: number; readonly B: number };
  readonly totalPoints: { readonly A: number; readonly B: number };
  readonly completedSets: readonly {
    readonly games: { readonly A: number; readonly B: number };
    readonly tieBreak: { readonly A: number; readonly B: number } | null;
    readonly winner: "A" | "B";
    readonly kind: string;
  }[];
}

export interface GoldenVector {
  readonly config: MatchConfig;
  /** The rally winners as a string of "A"/"B", applied in order. */
  readonly winners: string;
  /**
   * Squash "choice" tie-breaks only: one char per rally — "." (no decision),
   * "1" (short/set one) or "2" (long/set two). `winners[i]` and `gameSets[i]`
   * describe the same rally, so the ports can reconstruct the full event list
   * (winner, at, gameSet) without a bulky per-event JSON array.
   */
  readonly gameSets?: string;
  readonly snapshot: SerializedSnapshot;
}

/** Materialise a winner sequence (plus any choice decisions) into events. */
function eventsFrom(winners: string, gameSets?: string): PointEvent[] {
  return [...winners].map((winner, index) => {
    const decision = gameSets?.[index];
    return {
      winner: winner === "A" ? ("A" as const) : ("B" as const),
      at: index,
      ...(decision === "1" ? { gameSet: "one" as const } : {}),
      ...(decision === "2" ? { gameSet: "two" as const } : {}),
    };
  });
}

export function serializeSnapshot(snap: MatchSnapshot): SerializedSnapshot {
  return {
    finished: snap.finished,
    winner: snap.winner ?? null,
    setNumber: snap.setNumber,
    currentSetGames: { A: snap.currentSetGames.A, B: snap.currentSetGames.B },
    currentGame: serializeGame(snap),
    // Match JSON.stringify: keys with undefined values are dropped, so the
    // in-memory shape equals the committed JSON (pending-serve states).
    ...(snap.servingTeam === undefined ? {} : { servingTeam: snap.servingTeam }),
    ...(snap.servingSide === undefined ? {} : { servingSide: snap.servingSide }),
    moment: { ...snap.moment },
    totalGames: { A: snap.totalGames.A, B: snap.totalGames.B },
    totalPoints: { A: snap.totalPoints.A, B: snap.totalPoints.B },
    completedSets: snap.completedSets.map((set) => ({
      games: { A: set.games.A, B: set.games.B },
      tieBreak: set.tieBreak === undefined ? null : { A: set.tieBreak.A, B: set.tieBreak.B },
      winner: set.winner,
      kind: set.kind,
    })),
  };
}

function serializeGame(snap: MatchSnapshot): SerializedSnapshot["currentGame"] {
  const game = snap.currentGame;
  if (game === undefined) {
    return null;
  }
  if (game.kind === "standard") {
    return {
      kind: "standard",
      calls: { A: game.calls.A, B: game.calls.B },
      points: { A: game.points.A, B: game.points.B },
    };
  }
  if (game.kind === "squash") {
    return {
      kind: "squash",
      points: { A: game.points.A, B: game.points.B },
    };
  }
  if (game.kind === "pickleball") {
    return {
      kind: "pickleball",
      points: { A: game.points.A, B: game.points.B },
      serverNumber: game.serverNumber ?? null,
    };
  }
  return {
    kind: "tieBreak",
    tieBreakKind: game.tieBreakKind,
    target: game.target,
    points: { A: game.points.A, B: game.points.B },
  };
}

const DEUCE_MODES = ["advantage", "starPoint", "goldenPoint"] as const;
const THIRD_SETS = ["fullSet", "advantageSet", "superTieBreak"] as const;
const BEST_OFS = [1, 3] as const;
const SERVES = ["A", "B"] as const;

// Deterministic LCG (Numerical Recipes) — stable winner sequences across runs
// and languages, so regenerating the vectors is reproducible.
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0xff_ff_ff_ff;
  };
}

function winnerSequence(seed: number, length: number, biasToA: number): string {
  const next = lcg(seed);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += next() < biasToA ? "A" : "B";
  }
  return out;
}

/**
 * Attach a deterministic long/short decision to every choice-point rally in a
 * winner sequence. Without a decision the engine falls back to "one", so the
 * vectors would never exercise the decided target or the `gameSet` event
 * payload. The LCG keeps the decisions reproducible across runs/languages.
 */
function choiceDecisions(config: MatchConfig, winners: string, seed: number): string {
  const next = lcg(seed);
  let gameSets = "";
  for (let i = 0; i < winners.length; i += 1) {
    const before = computeMatch(config, eventsFrom(winners.slice(0, i), gameSets));
    let decision = ".";
    if (before.moment.kind === "setChoice") {
      decision = next() < 0.5 ? "1" : "2";
    }
    gameSets += decision;
  }
  return gameSets;
}

// Snapshot at several prefixes of each sequence, so mid-match states (deuce,
// tie-break, set points) are covered, not just the finished result.
const PREFIXES = [0, 1, 3, 8, 20, 45, 90, 160, 240] as const;
const BIASES = [0.5, 0.62, 0.4] as const;
/** Offset that keeps choice decisions off the rally-winner LCG stream. */
const CHOICE_SEED_OFFSET = 10_000;

/**
 * Push the prefix snapshots for one deterministic winner sequence. When
 * `decisions` is supplied (squash "choice"), every vector carries the matching
 * `gameSets` string and its events include those `gameSet` decisions.
 */
function pushSequence(
  vectors: GoldenVector[],
  config: MatchConfig,
  seed: number,
  bias: number,
  decisions?: (winners: string) => string,
): void {
  const full = winnerSequence(seed, 240, bias);
  const allSets = decisions === undefined ? undefined : decisions(full);
  for (const prefix of PREFIXES) {
    const winners = full.slice(0, prefix);
    if (allSets === undefined) {
      vectors.push({
        config,
        winners,
        snapshot: serializeSnapshot(computeMatch(config, eventsFrom(winners))),
      });
      continue;
    }
    const gameSets = allSets.slice(0, prefix);
    vectors.push({
      config,
      winners,
      gameSets,
      snapshot: serializeSnapshot(computeMatch(config, eventsFrom(winners, gameSets))),
    });
  }
}

/** Generate the full golden set (deterministic; a few thousand cases). */
export function goldenVectors(): GoldenVector[] {
  const vectors: GoldenVector[] = [];
  let seed = 1;

  for (const bestOf of BEST_OFS) {
    for (const deuceMode of DEUCE_MODES) {
      for (const thirdSet of THIRD_SETS) {
        for (const firstServe of SERVES) {
          const config: MatchConfig = { sport: "padel", bestOf, deuceMode, thirdSet, firstServe };
          for (const bias of BIASES) {
            seed += 1;
            pushSequence(vectors, config, seed, bias);
          }
        }
      }
    }
  }

  // Squash vectors (fixed-target tie-breaks: win by two, set one, set two)
  const SquashModes = ["par", "hiho"] as const;
  const SquashTargets = [9, 11, 15] as const;
  const SquashBestOfs = [1, 3, 5] as const;
  const SquashTiebreaks = ["winByTwo", "setOne", "setTwo"] as const;
  for (const bestOf of SquashBestOfs) {
    for (const squashMode of SquashModes) {
      for (const squashTarget of SquashTargets) {
        for (const squashTiebreak of SquashTiebreaks) {
          for (const firstServe of SERVES) {
            const config: MatchConfig = {
              sport: "squash",
              bestOf,
              deuceMode: "advantage",
              thirdSet: "fullSet",
              squashMode,
              squashTarget,
              squashTiebreak,
              firstServe,
            };
            for (const bias of BIASES) {
              seed += 1;
              pushSequence(vectors, config, seed, bias);
            }
          }
        }
      }
    }
  }

  // Squash "choice" tie-break: a deterministic long/short decision rides on
  // every choice-point rally as a `gameSet`, matching the app's own events.
  for (const bestOf of SquashBestOfs) {
    for (const squashMode of SquashModes) {
      for (const squashTarget of SquashTargets) {
        for (const firstServe of SERVES) {
          const config: MatchConfig = {
            sport: "squash",
            bestOf,
            deuceMode: "advantage",
            thirdSet: "fullSet",
            squashMode,
            squashTarget,
            squashTiebreak: "choice",
            firstServe,
          };
          for (const bias of BIASES) {
            seed += 1;
            const decisionSeed = seed + CHOICE_SEED_OFFSET;
            pushSequence(vectors, config, seed, bias, (winners) =>
              choiceDecisions(config, winners, decisionSeed),
            );
          }
        }
      }
    }
  }

  // Hand-crafted "choice" end-games: a random walk rarely reaches target-1 all
  // at a balanced score, so these pin the short and long decisions through a
  // completed game in the scenarios the setup UI offers — PAR to 9 and 11, and
  // HI-HO to 11. Each case contributes the choice-point snapshot and the
  // decided result.
  const ChoiceCases: readonly {
    readonly target: number;
    readonly squashMode: "par" | "hiho";
    readonly decision: "one" | "two";
  }[] = [
    { target: 9, squashMode: "par", decision: "one" },
    { target: 9, squashMode: "par", decision: "two" },
    { target: 11, squashMode: "par", decision: "one" },
    { target: 11, squashMode: "par", decision: "two" },
    { target: 11, squashMode: "hiho", decision: "one" },
    { target: 11, squashMode: "hiho", decision: "two" },
  ];
  for (const choiceCase of ChoiceCases) {
    const { target, squashMode, decision } = choiceCase;
    const config: MatchConfig = {
      sport: "squash",
      bestOf: 1,
      deuceMode: "advantage",
      thirdSet: "fullSet",
      squashMode,
      squashTarget: target,
      squashTiebreak: "choice",
      firstServe: "A",
    };
    // Balanced score at the choice point. PAR alternates points; HI-HO gets
    // there with one hand-out (the extra "B") then ten points on B's serve.
    const balanced =
      squashMode === "par"
        ? "A".repeat(target - 1) + "B".repeat(target - 1)
        : "A".repeat(target - 1) + "B".repeat(target);
    const pending = ".".repeat(balanced.length);
    vectors.push({
      config,
      winners: balanced,
      gameSets: pending,
      snapshot: serializeSnapshot(computeMatch(config, eventsFrom(balanced, pending))),
    });
    const winners = balanced + (decision === "one" ? "B" : "BB");
    const gameSets = pending + (decision === "one" ? "1" : "2.");
    vectors.push({
      config,
      winners,
      gameSets,
      snapshot: serializeSnapshot(computeMatch(config, eventsFrom(winners, gameSets))),
    });
  }

  // Squash serve boxes: each variant picks the first box of every hand, which
  // `servingSide` must reproduce identically across the three engines.
  const ServeBoxVariants = [
    { squashServeBoxes: "right" as const },
    { squashServeBoxes: "left" as const },
    {
      squashServeBoxes: "player" as const,
      squashServeBoxA: "left" as const,
      squashServeBoxB: "right" as const,
    },
  ];
  for (const squashMode of SquashModes) {
    for (const firstServe of SERVES) {
      for (const boxes of ServeBoxVariants) {
        const config: MatchConfig = {
          sport: "squash",
          bestOf: 1,
          deuceMode: "advantage",
          thirdSet: "fullSet",
          squashMode,
          squashTarget: 11,
          squashTiebreak: "winByTwo",
          ...boxes,
          firstServe,
        };
        for (const bias of [0.5, 0.62] as const) {
          seed += 1;
          pushSequence(vectors, config, seed, bias);
        }
      }
    }
  }

  // Pickleball vectors
  const PbTypes = ["singles", "doubles"] as const;
  const PbTargets = [11, 15, 21] as const;
  const PbTiebreaks = ["winByTwo", "winByOne"] as const;
  for (const bestOf of SquashBestOfs) {
    for (const pbType of PbTypes) {
      for (const pbTarget of PbTargets) {
        for (const pbTiebreak of PbTiebreaks) {
          for (const firstServe of SERVES) {
            const config: MatchConfig = {
              sport: "pickleball",
              bestOf,
              deuceMode: "advantage",
              thirdSet: "superTieBreak",
              pbType,
              pbTarget,
              pbTiebreak,
              firstServe,
            };
            for (const bias of BIASES) {
              seed += 1;
              pushSequence(vectors, config, seed, bias);
            }
          }
        }
      }
    }
  }

  return vectors;
}
