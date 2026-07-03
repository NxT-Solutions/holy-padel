import { computeMatch } from "./engine.ts";
import { otherTeam } from "./rules.ts";
import type {
  MatchConfig,
  MatchSnapshot,
  PointEvent,
  SetSummary,
  TeamId,
  TeamValues,
} from "./types.ts";

export type GameKind = "standard" | "tieBreak" | "superTieBreak";

/** One completed game (a tie-break counts as a single game). */
export interface GameRecord {
  readonly setNumber: number;
  /** 1-based position of the game within its set. */
  readonly gameNumber: number;
  readonly kind: GameKind;
  /** Serving team — for tie-breaks, the pair that served the first point. */
  readonly server: TeamId;
  readonly winner: TeamId;
  /** Rally points played in this game, per team. */
  readonly points: TeamValues<number>;
  readonly startedAt: number;
  readonly endedAt: number;
}

export interface SetStats {
  readonly setNumber: number;
  readonly summary: SetSummary;
  readonly durationMs: number;
  /** Standard games won by the receiving team, in playing order. */
  readonly breakGames: readonly { readonly gameNumber: number; readonly team: TeamId }[];
}

export interface ServiceRecord {
  readonly held: number;
  readonly served: number;
}

export interface MatchStats {
  readonly games: readonly GameRecord[];
  readonly sets: readonly SetStats[];
  /** Standard games won while receiving. */
  readonly breaks: TeamValues<number>;
  readonly service: TeamValues<ServiceRecord>;
  readonly longestGame: GameRecord | undefined;
  readonly totalPoints: TeamValues<number>;
  readonly durationMs: number;
}

interface OpenGame {
  setNumber: number;
  gameNumber: number;
  kind: GameKind;
  server: TeamId;
  points: { A: number; B: number };
  startedAt: number;
}

interface Recorder {
  games: GameRecord[];
  sets: SetStats[];
  open: OpenGame | undefined;
  setStartedAt: number | undefined;
  setGameCount: number;
  previousTotalGames: TeamValues<number>;
  previousSetCount: number;
}

function gameKindOf(snapshot: MatchSnapshot): GameKind {
  const game = snapshot.currentGame;
  if (game === undefined || game.kind === "standard") {
    return "standard";
  }
  if (game.tieBreakKind === "superTieBreak") {
    return "superTieBreak";
  }
  return "tieBreak";
}

function openGameIfNeeded(recorder: Recorder, before: MatchSnapshot, at: number): OpenGame {
  if (recorder.open !== undefined) {
    return recorder.open;
  }
  recorder.setGameCount += 1;
  recorder.setStartedAt ??= at;
  const open: OpenGame = {
    setNumber: before.setNumber,
    gameNumber: recorder.setGameCount,
    kind: gameKindOf(before),
    server: before.servingTeam,
    points: { A: 0, B: 0 },
    startedAt: at,
  };
  recorder.open = open;
  return open;
}

function closeGameIfFinished(recorder: Recorder, after: MatchSnapshot, at: number): void {
  const { open, previousTotalGames } = recorder;
  const finished =
    after.totalGames.A !== previousTotalGames.A || after.totalGames.B !== previousTotalGames.B;
  recorder.previousTotalGames = after.totalGames;
  if (!finished || open === undefined) {
    return;
  }
  const winner: TeamId = after.totalGames.A > previousTotalGames.A ? "A" : "B";
  recorder.games.push({
    setNumber: open.setNumber,
    gameNumber: open.gameNumber,
    kind: open.kind,
    server: open.server,
    winner,
    points: { A: open.points.A, B: open.points.B },
    startedAt: open.startedAt,
    endedAt: at,
  });
  recorder.open = undefined;
}

function closeSetIfFinished(recorder: Recorder, after: MatchSnapshot, at: number): void {
  if (after.completedSets.length <= recorder.previousSetCount) {
    return;
  }
  const summary = after.completedSets[recorder.previousSetCount];
  if (summary !== undefined) {
    const setNumber = recorder.previousSetCount + 1;
    const breakGames = recorder.games
      .filter(
        (game) =>
          game.setNumber === setNumber && game.kind === "standard" && game.winner !== game.server,
      )
      .map((game) => ({ gameNumber: game.gameNumber, team: game.winner }));
    recorder.sets.push({
      setNumber,
      summary,
      durationMs: recorder.setStartedAt === undefined ? 0 : at - recorder.setStartedAt,
      breakGames,
    });
  }
  recorder.previousSetCount = after.completedSets.length;
  recorder.setStartedAt = undefined;
  recorder.setGameCount = 0;
}

function breaksFor(standardGames: readonly GameRecord[], team: TeamId): number {
  return standardGames.filter((game) => game.winner === team && game.server === otherTeam(team))
    .length;
}

function serviceFor(standardGames: readonly GameRecord[], team: TeamId): ServiceRecord {
  const served = standardGames.filter((game) => game.server === team);
  return { held: served.filter((game) => game.winner === team).length, served: served.length };
}

function longestOf(standardGames: readonly GameRecord[]): GameRecord | undefined {
  return standardGames.reduce<GameRecord | undefined>((longest, game) => {
    const gamePoints = game.points.A + game.points.B;
    const longestPoints = longest === undefined ? -1 : longest.points.A + longest.points.B;
    return gamePoints > longestPoints ? game : longest;
  }, undefined);
}

/**
 * Replay a match and derive per-game and per-set statistics for the
 * overview screens: breaks, service games held, longest game, durations.
 */
export function computeStats(config: MatchConfig, events: readonly PointEvent[]): MatchStats {
  const recorder: Recorder = {
    games: [],
    sets: [],
    open: undefined,
    setStartedAt: undefined,
    setGameCount: 0,
    previousTotalGames: { A: 0, B: 0 },
    previousSetCount: 0,
  };

  events.forEach((event, index) => {
    const before = computeMatch(config, events.slice(0, index));
    const after = computeMatch(config, events.slice(0, index + 1));
    const open = openGameIfNeeded(recorder, before, event.at);
    open.points[event.winner] += 1;
    closeGameIfFinished(recorder, after, event.at);
    closeSetIfFinished(recorder, after, event.at);
  });

  const standardGames = recorder.games.filter((game) => game.kind === "standard");
  const final = computeMatch(config, events);
  const [firstEvent] = events;
  const lastEvent = events.at(-1);

  return {
    games: recorder.games,
    sets: recorder.sets,
    breaks: { A: breaksFor(standardGames, "A"), B: breaksFor(standardGames, "B") },
    service: { A: serviceFor(standardGames, "A"), B: serviceFor(standardGames, "B") },
    longestGame: longestOf(standardGames),
    totalPoints: final.totalPoints,
    durationMs:
      firstEvent === undefined || lastEvent === undefined ? 0 : lastEvent.at - firstEvent.at,
  };
}
