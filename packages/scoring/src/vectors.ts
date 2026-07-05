import { computeMatch } from "./engine.ts";
import type { MatchConfig, MatchSnapshot } from "./types.ts";

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
      };
  readonly servingTeam: "A" | "B";
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
  readonly snapshot: SerializedSnapshot;
}

export function serializeSnapshot(snap: MatchSnapshot): SerializedSnapshot {
  return {
    finished: snap.finished,
    winner: snap.winner ?? null,
    setNumber: snap.setNumber,
    currentSetGames: { A: snap.currentSetGames.A, B: snap.currentSetGames.B },
    currentGame: serializeGame(snap),
    servingTeam: snap.servingTeam,
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

// Snapshot at several prefixes of each sequence, so mid-match states (deuce,
// tie-break, set points) are covered, not just the finished result.
const PREFIXES = [0, 1, 3, 8, 20, 45, 90, 160, 240] as const;
const BIASES = [0.5, 0.62, 0.4] as const;

/** Generate the full golden set (deterministic; ~a few hundred cases). */
export function goldenVectors(): GoldenVector[] {
  const vectors: GoldenVector[] = [];
  let seed = 1;
  for (const bestOf of BEST_OFS) {
    for (const deuceMode of DEUCE_MODES) {
      for (const thirdSet of THIRD_SETS) {
        for (const firstServe of SERVES) {
          const config: MatchConfig = { bestOf, deuceMode, thirdSet, firstServe };
          for (const bias of BIASES) {
            seed += 1;
            const full = winnerSequence(seed, 240, bias);
            for (const prefix of PREFIXES) {
              const winners = full.slice(0, prefix);
              const events = [...winners].map((w, i) => ({
                winner: w === "A" ? ("A" as const) : ("B" as const),
                at: i,
              }));
              vectors.push({
                config,
                winners,
                snapshot: serializeSnapshot(computeMatch(config, events)),
              });
            }
          }
        }
      }
    }
  }
  return vectors;
}
