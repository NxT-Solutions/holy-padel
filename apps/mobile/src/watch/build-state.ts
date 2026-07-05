import type { MatchSummary } from "@holy-padel/db";
import type { MatchSnapshot, TeamId } from "@holy-padel/scoring";
import { watchStatusLabel } from "@holy-padel/scoring";
import {
  durationLabel,
  finalScoreLine,
  liveScoreLine,
  opponentsOf,
  ownerTeamOf,
  pairInitials,
  pointDisplay,
  teamInitials,
  watchSetLabel,
} from "@/lib/format.ts";

/**
 * Builds the `/holy-padel/state` payload the phone pushes to the watches
 * (docs/watch-sync.md). Pure and transport-agnostic — the WatchConnectivity and
 * Wearable Data Layer bridges serialise the same object. Every display string is
 * produced by the existing phone formatters, so the FIP rules and their wording
 * live in exactly one place.
 */

const SCHEMA_VERSION = 1;

export interface WatchTeam {
  readonly short: string;
  readonly serving: boolean;
}

export interface WatchWon {
  readonly winnerShort: string;
  readonly scoreLine: string;
  readonly duration: string;
}

export interface WatchLast {
  readonly line: string;
  readonly won: boolean;
}

export interface WatchState {
  readonly v: number;
  readonly phase: "idle" | "live" | "won";
  readonly clock: string;
  readonly court?: string;
  readonly setLabel: string;
  readonly teamA: WatchTeam;
  readonly teamB: WatchTeam;
  readonly pointA: string;
  readonly pointB: string;
  readonly games: string;
  readonly status: string;
  /**
   * Epoch ms the live/won match started — the watches use it as the workout
   * session's start time and as the cross-device dedup key. Absent when idle.
   */
  readonly startedAt?: number;
  readonly won?: WatchWon;
  readonly last?: WatchLast;
}

export interface WatchStateInput {
  /** The device owner's player id — decides the win/loss of the idle hint. */
  readonly ownerId: string;
  /** Epoch ms, for the match clock. */
  readonly now: number;
  /** The live match and its snapshot, when one is in progress or just finished. */
  readonly live?: { readonly match: MatchSummary; readonly snapshot: MatchSnapshot };
  /** Most recent finished match, shown as the idle quick-start hint. */
  readonly last?: MatchSummary;
}

const EMPTY_TEAM: WatchTeam = { short: "", serving: false };

export function buildWatchState(input: WatchStateInput): WatchState {
  const { live, last, now, ownerId } = input;
  if (live !== undefined) {
    return live.snapshot.finished
      ? wonState(live.match, live.snapshot, now)
      : liveState(live.match, live.snapshot, now);
  }
  return idleState(last, ownerId);
}

function courtField(match: MatchSummary): { court?: string } {
  // exactOptionalPropertyTypes: omit the key rather than set it to undefined.
  return match.court === undefined ? {} : { court: match.court };
}

function liveState(match: MatchSummary, snapshot: MatchSnapshot, now: number): WatchState {
  const shorts = teamInitials(match);
  return {
    v: SCHEMA_VERSION,
    phase: "live",
    clock: durationLabel(now - match.startedAt),
    ...courtField(match),
    setLabel: watchSetLabel(snapshot),
    teamA: { short: shorts.A, serving: snapshot.servingTeam === "A" },
    teamB: { short: shorts.B, serving: snapshot.servingTeam === "B" },
    pointA: pointDisplay(snapshot, "A"),
    pointB: pointDisplay(snapshot, "B"),
    games: liveScoreLine(snapshot),
    status: watchStatusLabel(snapshot.moment, shorts) ?? "",
    startedAt: match.startedAt,
  };
}

function wonState(match: MatchSummary, snapshot: MatchSnapshot, now: number): WatchState {
  const shorts = teamInitials(match);
  const winner: TeamId = snapshot.winner ?? "A";
  const scoreLine = finalScoreLine(snapshot);
  const duration = durationLabel(now - match.startedAt);
  return {
    v: SCHEMA_VERSION,
    phase: "won",
    clock: duration,
    ...courtField(match),
    setLabel: "",
    teamA: { short: shorts.A, serving: false },
    teamB: { short: shorts.B, serving: false },
    pointA: "",
    pointB: "",
    games: scoreLine,
    status: "",
    startedAt: match.startedAt,
    won: { winnerShort: winner === "A" ? shorts.A : shorts.B, scoreLine, duration },
  };
}

function idleState(last: MatchSummary | undefined, ownerId: string): WatchState {
  const base: WatchState = {
    v: SCHEMA_VERSION,
    phase: "idle",
    clock: "",
    setLabel: "",
    teamA: EMPTY_TEAM,
    teamB: EMPTY_TEAM,
    pointA: "",
    pointB: "",
    games: "",
    status: "",
  };
  if (last === undefined) {
    return base;
  }
  const ownerTeam = ownerTeamOf(last, ownerId);
  const opponentShort = pairInitials(opponentsOf(last, ownerTeam));
  return {
    ...base,
    last: {
      line: `${last.scoreLine ?? ""} vs ${opponentShort}`.trim(),
      won: last.winner === ownerTeam,
    },
  };
}
