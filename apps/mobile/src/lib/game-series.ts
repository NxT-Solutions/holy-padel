import type { MatchConfig, PointEvent } from "@holy-padel/scoring";
import { replayMatch } from "@holy-padel/scoring";

/** One point inside a game: when it was played and the lead after it. */
export interface GameSeriesStep {
  readonly t: number;
  /** Points for team A minus points for team B, within the game. */
  readonly lead: number;
  /**
   * True when the serve changed hands on this rally (a hand-out in HIHO
   * squash, a break of serve in padel) — marked on the score-race chart so
   * serve stretches read as plateaus between markers.
   */
  readonly handOut: boolean;
}

/** The point-by-point lead ("snake") of one completed game. */
export interface GameSeries {
  readonly setNumber: number;
  /** 1-based position of the game within its set. */
  readonly gameNumber: number;
  readonly pointsA: number;
  readonly pointsB: number;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly steps: readonly GameSeriesStep[];
}

interface OpenGame {
  readonly setNumber: number;
  readonly a: number;
  readonly b: number;
  readonly steps: readonly GameSeriesStep[];
}

function closeGame(open: OpenGame, games: GameSeries[]): void {
  const [first] = open.steps;
  const last = open.steps.at(-1);
  if (first === undefined || last === undefined) {
    return;
  }
  games.push({
    setNumber: open.setNumber,
    gameNumber: games.filter((game) => game.setNumber === open.setNumber).length + 1,
    pointsA: open.a,
    pointsB: open.b,
    startedAt: first.t,
    endedAt: last.t,
    steps: open.steps,
  });
}

/**
 * Walk a match's ledger and split it into per-game point sequences, tracking
 * the in-game lead after every rally — the data behind the score-race chart.
 * Serve events score no rally and are skipped (as in computeStats).
 */
export function computeGameSeries(
  config: MatchConfig,
  events: readonly PointEvent[],
): GameSeries[] {
  const games: GameSeries[] = [];
  let open: OpenGame | undefined;
  let previousTotalGames = { A: 0, B: 0 };
  let previousSetCount = 0;
  const snapshots = replayMatch(config, events);

  events.forEach((event, index) => {
    const before = snapshots[index];
    const after = snapshots[index + 1];
    if (event.kind === "serve" || before === undefined || after === undefined) {
      return;
    }
    const gameFinished =
      after.totalGames.A !== previousTotalGames.A || after.totalGames.B !== previousTotalGames.B;
    const setFinished = after.completedSets.length > previousSetCount;

    if (open === undefined) {
      open = { setNumber: before.setNumber, a: 0, b: 0, steps: [] };
    }
    const current: OpenGame = open;
    const a = event.winner === "A" ? current.a + 1 : current.a;
    const b = event.winner === "B" ? current.b + 1 : current.b;
    const handOut =
      before.servingTeam !== undefined &&
      after.servingTeam !== undefined &&
      after.servingTeam !== before.servingTeam;
    open = {
      setNumber: current.setNumber,
      a,
      b,
      steps: [...current.steps, { t: event.at, lead: a - b, handOut }],
    };
    previousTotalGames = after.totalGames;
    previousSetCount = after.completedSets.length;

    // Close AFTER the rally lands on it: the final point of a game belongs
    // to that game, not to a phantom follow-up series.
    if (open.steps.length > 0 && (gameFinished || setFinished)) {
      closeGame(open, games);
      open = undefined;
    }
  });

  if (open !== undefined) {
    closeGame(open, games);
  }
  return games;
}
