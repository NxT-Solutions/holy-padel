import type { MatchSummary } from "@holy-padel/db";
import {
  createMatch,
  deleteMatch,
  finishMatch,
  getMatch,
  loadEvents,
  pauseMatch,
  removeLastEvent,
  resumeMatch,
  scorePoint as scorePointDb,
  setPendingGameSet,
} from "@holy-padel/db";
import type { MatchSnapshot, PointEvent, TeamId } from "@holy-padel/scoring";
import { computeMatch, computeStats, statusLabel } from "@holy-padel/scoring";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack } from "tamagui";
import { EndSheet } from "@/components/end-sheet.tsx";
import {
  LiveActionBar,
  LiveHeader,
  SetChips,
  SetChoiceSheet,
  TeamCard,
} from "@/components/live-parts.tsx";
import { MatchWon } from "@/components/match-won.tsx";
import { Body, Display, LiveDot, Pill } from "@/components/ui.tsx";
import { useDbMutation, useDbQuery } from "@/db/provider.tsx";
import { durationLabel, finalScoreLine, playedMs, pointDisplay, teamNames } from "@/lib/format.ts";
import { scoreHaptic, undoHaptic } from "@/lib/haptics.ts";
import { stopAndSaveMatch } from "@/lib/match-actions.ts";
import { goHome, newMatchId } from "@/lib/navigation.ts";
import { useNow } from "@/lib/use-now.ts";
import { colors, textAlpha } from "@/theme/colors.ts";

/** Persist the finished result once the engine says the match is over. */
function usePersistFinish(
  id: string,
  match: MatchSummary | undefined,
  snapshot: MatchSnapshot | undefined,
  events: readonly PointEvent[],
): void {
  const mutate = useDbMutation();
  // Keyed by match id: a rematch replaces the route param without remounting.
  const persistedFinish = useRef<string | undefined>(undefined);
  useEffect(() => {
    const pending =
      match?.status === "live" &&
      snapshot?.finished === true &&
      snapshot.winner !== undefined &&
      persistedFinish.current !== id;
    if (!pending) {
      return;
    }
    persistedFinish.current = id;
    const winner = snapshot.winner ?? "A";
    const lastEvent = events.at(-1);
    mutate((driver) => {
      finishMatch(driver, id, {
        winner,
        endedAt: lastEvent?.at ?? Date.now(),
        scoreLine: finalScoreLine(snapshot),
      });
    });
  }, [match, snapshot, events, id, mutate]);
}

function squashTargetOf(snapshot: MatchSnapshot): number {
  return snapshot.config.sport === "squash" ? snapshot.config.squashTarget : 11;
}

/** The status-pill call while a long/short decision is staged for the next rally. */
function stagedChoiceLabel(staged: "one" | "two", target: number): string {
  return staged === "one" ? `SHORT · TO ${String(target)}` : `LONG · TO ${String(target + 1)}`;
}

export default function LiveScreen(): ReactNode {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const now = useNow(10_000);
  const mutate = useDbMutation();
  const [ending, setEnding] = useState(false);

  const match = useDbQuery((driver) => getMatch(driver, id));
  const events = useDbQuery((driver) => loadEvents(driver, id));
  const rematchStarted = useRef(false);
  useEffect(() => {
    rematchStarted.current = false;
  }, []);
  const snapshot = match === undefined ? undefined : computeMatch(match.config, events);
  const finishedStats =
    match !== undefined && snapshot?.finished === true
      ? computeStats(match.config, events)
      : undefined;

  usePersistFinish(id, match, snapshot, events);

  if (match === undefined || snapshot === undefined) {
    // Deleted or unknown match (stale link, back after discard): recover home.
    return <Redirect href="/" />;
  }

  const names = teamNames(match);

  if (snapshot.finished && finishedStats !== undefined) {
    return (
      <MatchWon
        match={match}
        snapshot={snapshot}
        stats={finishedStats}
        now={now}
        onRematch={() => {
          if (rematchStarted.current) {
            return;
          }
          rematchStarted.current = true;
          const rematchId = newMatchId();
          mutate((driver) => {
            createMatch(driver, {
              id: rematchId,
              config: {
                ...match.config,
                firstServePending: match.config.firstServeOriginallyUndecided ?? false,
              },
              players: match.players,
              ...(match.court === undefined ? {} : { court: match.court }),
              ...(match.location === undefined ? {} : { location: match.location }),
              startedAt: Date.now(),
            });
          });
          router.replace(`/live/${rematchId}`);
        }}
      />
    );
  }

  const paused = match.pausedAt !== undefined;

  const scorePoint = (team: TeamId): void => {
    scoreHaptic();
    // scorePointDb re-reads committed state and refuses once the match is
    // paused or decided. It also resolves undecided first serves (game 1 and
    // pickleball games 2+) and attaches a staged squash long/short decision,
    // so the phone, the watch, and replays all share one code path.
    mutate((driver) => {
      scorePointDb(driver, id, team, Date.now());
    });
  };

  const chooseGameSet = (choice: "one" | "two"): void => {
    mutate((driver) => {
      setPendingGameSet(driver, id, choice);
    });
  };

  const undoPoint = (): void => {
    if (events.length === 0) {
      return;
    }
    undoHaptic();
    mutate((driver) => {
      removeLastEvent(driver, id);
    });
  };

  const togglePause = (): void => {
    mutate((driver) => {
      if (match.pausedAt === undefined) {
        pauseMatch(driver, id, Date.now());
      } else {
        resumeMatch(driver, id, Date.now());
      }
    });
  };

  const stopAndSave = (): void => {
    mutate((driver) => {
      stopAndSaveMatch(driver, id, Date.now());
    });
    goHome();
  };

  const discardMatch = (): void => {
    mutate((driver) => {
      deleteMatch(driver, id);
    });
    goHome();
  };

  const squashTarget = squashTargetOf(snapshot);
  // The staged long/short decision lives in the ledger row, so a choice made
  // on the watch closes the phone's popup too (and vice versa).
  const choicePending = snapshot.moment.kind === "setChoice";
  const staged = match.pendingGameSet;
  const label =
    choicePending && staged !== undefined
      ? stagedChoiceLabel(staged, squashTarget)
      : statusLabel(snapshot.moment, names);

  return (
    <View flex={1} backgroundColor={colors.screen}>
      <YStack
        flex={1}
        paddingTop={insets.top + 10}
        paddingBottom={insets.bottom + 14}
        paddingHorizontal={16}
        gap={12}
      >
        <LiveHeader
          paused={paused}
          court={match.court}
          sport={match.config.sport}
          setNumber={snapshot.setNumber}
          clock={durationLabel(playedMs(match, now))}
        />

        <SetChips match={match} snapshot={snapshot} />

        <YStack flex={1} gap={10} opacity={paused ? 0.4 : 1}>
          <TeamCard
            name={names.A}
            point={pointDisplay(snapshot, "A")}
            testID="point-A"
            serving={snapshot.servingTeam === "A"}
            servingSide={snapshot.servingSide}
            serverNumber={
              snapshot.currentGame?.kind === "pickleball" ? snapshot.currentGame.serverNumber : null
            }
            hint={snapshot.servingTeam === undefined ? "TAP TO TAKE SERVE" : undefined}
            onScore={() => {
              scorePoint("A");
            }}
          />
          <TeamCard
            name={names.B}
            point={pointDisplay(snapshot, "B")}
            testID="point-B"
            serving={snapshot.servingTeam === "B"}
            servingSide={snapshot.servingSide}
            serverNumber={
              snapshot.currentGame?.kind === "pickleball" ? snapshot.currentGame.serverNumber : null
            }
            hint={snapshot.servingTeam === undefined ? "TAP TO TAKE SERVE" : undefined}
            onScore={() => {
              scorePoint("B");
            }}
          />
        </YStack>

        {label === undefined ? null : (
          <Pill
            alignSelf="center"
            backgroundColor={colors.ink}
            paddingVertical={10}
            paddingHorizontal={22}
            testID="status-pill"
          >
            <Display fontSize={15} letterSpacing={1.5} color={colors.lime}>
              {label}
            </Display>
          </Pill>
        )}

        <LiveActionBar
          paused={paused}
          onUndo={undoPoint}
          onTogglePause={togglePause}
          onEnd={() => {
            setEnding(true);
          }}
        />

        <XStack alignItems="center" justifyContent="center" gap={6}>
          <LiveDot size={6} />
          <Body fontSize={11} fontWeight="600" color={textAlpha(0.45)}>
            {paused
              ? "Paused — workout paused on your watch too"
              : "Synced — your watch mirrors the score"}
          </Body>
        </XStack>
      </YStack>

      {ending ? (
        <EndSheet
          onStopSave={stopAndSave}
          onDiscard={discardMatch}
          onCancel={() => {
            setEnding(false);
          }}
        />
      ) : null}

      {!paused && choicePending && staged === undefined && (
        <SetChoiceSheet target={squashTarget} onChoose={chooseGameSet} />
      )}
    </View>
  );
}
