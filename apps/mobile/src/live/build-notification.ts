import { watchStatusLabel } from "@holy-padel/scoring";
import {
  liveScoreLine,
  playedMs,
  pointDisplay,
  teamInitials,
  watchSetLabel,
} from "@/lib/format.ts";
import type { WatchIntent } from "@/watch/apply-intent.ts";
import { INTENT_PATHS } from "@/watch/apply-intent.ts";
import type { GatheredInput } from "@/watch/gather-input.ts";

/** One notification button: the id handed back on a tap, and its label. */
export interface LiveNotificationAction {
  readonly id: string;
  readonly label: string;
}

/** What the Android live notification shows (see modules/live-notification). */
export interface LiveNotificationContent {
  readonly title: string;
  readonly text: string;
  /** The status-bar chip on Android 16 Live Updates — kept to the point score. */
  readonly chip: string;
  /** Epoch ms the match clock counts up from; 0 while paused (no running clock). */
  readonly clockBase: number;
  readonly color: string;
  readonly url: string;
  readonly actions: readonly LiveNotificationAction[];
}

const DEFAULT_COLOR = "#FF6B35";

/**
 * The notification for a match in play — undefined when nothing is live (or
 * the match was just won), which takes the notification down. Every string
 * comes from the same formatters as the live screen and the watches.
 */
export function buildLiveNotification(
  input: GatheredInput,
  now: number,
): LiveNotificationContent | undefined {
  const { live } = input;
  if (live === undefined || live.snapshot.finished) {
    return;
  }
  const { match, snapshot } = live;
  const shorts = teamInitials(match);
  const paused = match.pausedAt !== undefined;
  const pointA = pointDisplay(snapshot, "A");
  const pointB = pointDisplay(snapshot, "B");
  const status = watchStatusLabel(snapshot.moment, shorts, snapshot.config.sport);
  const choosing = snapshot.moment.kind === "setChoice" && match.pendingGameSet === undefined;
  const line = [watchSetLabel(snapshot), liveScoreLine(snapshot)].filter((part) => part !== "");
  const lead = paused ? "PAUSED" : (status ?? undefined);
  let actions: LiveNotificationAction[] = [
    { id: "score:A", label: `+ ${shorts.A}` },
    { id: "score:B", label: `+ ${shorts.B}` },
    { id: "undo", label: "UNDO" },
  ];
  if (paused) {
    actions = [{ id: "pause", label: "RESUME" }];
  } else if (choosing) {
    // Short or long is the receiver's call — make it on the phone or watch.
    actions = [{ id: "undo", label: "UNDO" }];
  }
  return {
    title: `${shorts.A}  ${pointA} – ${pointB}  ${shorts.B}`,
    text: [lead, ...line].filter((part) => part !== undefined && part !== "").join(" · "),
    chip: `${pointA}–${pointB}`,
    clockBase: paused ? 0 : now - playedMs(match, now),
    color: input.palette?.accent ?? DEFAULT_COLOR,
    url: `holy-padel://live/${match.id}`,
    actions,
  };
}

/** The watch intent a notification button stands for — the phone applies both the same way. */
export function intentForAction(id: string): WatchIntent | undefined {
  if (id === "score:A" || id === "score:B") {
    return { path: INTENT_PATHS.score, body: id.slice(-1) };
  }
  if (id === "undo") {
    return { path: INTENT_PATHS.undo, body: "" };
  }
  return id === "pause" ? { path: INTENT_PATHS.pause, body: "" } : undefined;
}
