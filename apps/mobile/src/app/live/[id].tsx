import type { MatchSummary } from "@holy-padel/db";
import {
  appendEvent,
  createMatch,
  deleteMatch,
  finishMatch,
  getMatch,
  loadEvents,
  removeLastEvent,
} from "@holy-padel/db";
import type { MatchSnapshot, MatchStats, PointEvent, TeamId } from "@holy-padel/scoring";
import { computeMatch, computeStats, statusLabel } from "@holy-padel/scoring";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack } from "tamagui";
import { Undo } from "@/components/icons.tsx";
import { Body, Display, LiveDot, Pill } from "@/components/ui.tsx";
import { useDbMutation, useDbQuery } from "@/db/provider.tsx";
import { confirmDestructive } from "@/lib/confirm.ts";
import { dayLabel, durationLabel, finalScoreLine, pointDisplay, teamNames } from "@/lib/format.ts";
import { goHome, newMatchId } from "@/lib/navigation.ts";
import { useNow } from "@/lib/use-now.ts";
import { colors, inkAlpha, limeAlpha, whiteAlpha } from "@/theme/colors.ts";

function SetChip({
  label,
  score,
  state,
}: {
  readonly label: string;
  readonly score: string;
  readonly state: "done" | "current" | "future";
}): ReactNode {
  const testId = `set-chip-${label.toLowerCase().replaceAll(" ", "-")}`;
  if (state === "done") {
    return (
      <YStack
        flex={1}
        backgroundColor={colors.ink}
        borderRadius={14}
        paddingVertical={9}
        alignItems="center"
      >
        <Body fontSize={9} fontWeight="800" letterSpacing={1.5} color={whiteAlpha(0.5)}>
          {label}
        </Body>
        <Display fontSize={20} color={colors.white} marginTop={2} testID={testId}>
          {score}
        </Display>
      </YStack>
    );
  }
  if (state === "current") {
    return (
      <YStack
        flex={1}
        backgroundColor={colors.white}
        borderWidth={2}
        borderColor={colors.lime}
        borderRadius={14}
        paddingVertical={7}
        alignItems="center"
        boxShadow="0 2px 10px rgba(14, 17, 22, 0.06)"
      >
        <Body fontSize={9} fontWeight="800" letterSpacing={1.5} color={colors.limeInk}>
          {label}
        </Body>
        <Display fontSize={20} marginTop={2} testID={testId}>
          {score}
        </Display>
      </YStack>
    );
  }
  return (
    <YStack
      flex={1}
      borderWidth={1}
      borderColor={inkAlpha(0.14)}
      borderRadius={14}
      paddingVertical={8}
      alignItems="center"
    >
      <Body fontSize={9} fontWeight="800" letterSpacing={1.5} color={inkAlpha(0.35)}>
        {label}
      </Body>
      <Display fontSize={20} color={inkAlpha(0.25)} marginTop={2} testID={testId}>
        –
      </Display>
    </YStack>
  );
}

function TeamCard({
  name,
  point,
  serving,
  onScore,
  testID,
}: {
  readonly name: string;
  readonly point: string;
  readonly serving: boolean;
  readonly onScore: () => void;
  readonly testID: string;
}): ReactNode {
  return (
    <XStack
      flex={1}
      backgroundColor={colors.white}
      borderRadius={22}
      borderWidth={2}
      borderColor={inkAlpha(0.05)}
      paddingVertical={18}
      paddingHorizontal={22}
      alignItems="center"
      justifyContent="space-between"
      boxShadow="0 2px 14px rgba(14, 17, 22, 0.07)"
      pressStyle={{ opacity: 0.9, scale: 0.99 }}
      role="button"
      aria-label={`Point ${name}`}
      onPress={onScore}
    >
      <YStack gap={7}>
        <XStack alignItems="center" gap={8}>
          <View
            width={12}
            height={12}
            borderRadius={6}
            backgroundColor={colors.lime}
            opacity={serving ? 1 : 0}
            boxShadow={serving ? `0 0 0 3px ${limeAlpha(0.3)}` : "unset"}
            testID={`${testID}-serve${serving ? "-on" : "-off"}`}
          />
          <Display fontSize={23}>{name.toUpperCase()}</Display>
        </XStack>
        <Body fontSize={10} fontWeight="800" letterSpacing={1.6} color={inkAlpha(0.35)}>
          TAP TO SCORE +1
        </Body>
      </YStack>
      <Display fontSize={112} lineHeight={100} testID={testID}>
        {point}
      </Display>
    </XStack>
  );
}

function MatchWon({
  match,
  snapshot,
  stats,
  now,
  onRematch,
}: {
  readonly match: MatchSummary;
  readonly snapshot: MatchSnapshot;
  readonly stats: MatchStats;
  readonly now: number;
  readonly onRematch: () => void;
}): ReactNode {
  const insets = useSafeAreaInsets();
  const winner = snapshot.winner ?? "A";
  const loser: TeamId = winner === "A" ? "B" : "A";
  const names = teamNames(match);
  const meta = [
    dayLabel(match.startedAt, now),
    match.court?.toUpperCase(),
    durationLabel(stats.durationMs),
  ]
    .filter((part): part is string => part !== undefined)
    .join(" · ");
  return (
    <YStack
      flex={1}
      backgroundColor={colors.inkDeep}
      alignItems="center"
      paddingTop={insets.top + 46}
      paddingBottom={insets.bottom + 16}
      paddingHorizontal={20}
    >
      <Body fontSize={11} fontWeight="800" letterSpacing={2} color={whiteAlpha(0.45)}>
        {meta}
      </Body>
      <Display fontSize={58} lineHeight={60} color={colors.lime} letterSpacing={1} marginTop={14}>
        MATCH WON
      </Display>
      <Display fontSize={34} color={colors.white} marginTop={18}>
        {names[winner].toUpperCase()}
      </Display>
      <Body
        fontSize={12}
        fontWeight="700"
        letterSpacing={1.5}
        color={whiteAlpha(0.45)}
        marginTop={6}
      >
        {`DEF. ${names[loser].toUpperCase()}`}
      </Body>
      <Display fontSize={76} lineHeight={78} color={colors.white} marginTop={22} testID="won-score">
        {finalScoreLine(snapshot)}
      </Display>
      <XStack gap={8} marginTop={26} width="100%">
        <YStack
          flex={1}
          backgroundColor={colors.inkRaised}
          borderRadius={16}
          paddingVertical={12}
          alignItems="center"
        >
          <Display fontSize={22} color={colors.white}>
            {`${String(snapshot.totalGames[winner])}–${String(snapshot.totalGames[loser])}`}
          </Display>
          <Body
            fontSize={9}
            fontWeight="800"
            letterSpacing={1.4}
            color={whiteAlpha(0.45)}
            marginTop={2}
          >
            GAMES
          </Body>
        </YStack>
        <YStack
          flex={1}
          backgroundColor={colors.inkRaised}
          borderRadius={16}
          paddingVertical={12}
          alignItems="center"
        >
          <Display fontSize={22} color={colors.white}>
            {`${String(snapshot.totalPoints[winner])}–${String(snapshot.totalPoints[loser])}`}
          </Display>
          <Body
            fontSize={9}
            fontWeight="800"
            letterSpacing={1.4}
            color={whiteAlpha(0.45)}
            marginTop={2}
          >
            POINTS
          </Body>
        </YStack>
        <YStack
          flex={1}
          backgroundColor={colors.inkRaised}
          borderRadius={16}
          paddingVertical={12}
          alignItems="center"
        >
          <Display fontSize={22} color={colors.white}>
            {String(stats.breaks[winner])}
          </Display>
          <Body
            fontSize={9}
            fontWeight="800"
            letterSpacing={1.4}
            color={whiteAlpha(0.45)}
            marginTop={2}
          >
            BREAKS
          </Body>
        </YStack>
      </XStack>
      <YStack marginTop="auto" width="100%" gap={9}>
        <XStack
          height={60}
          backgroundColor={colors.lime}
          borderRadius={17}
          alignItems="center"
          justifyContent="center"
          pressStyle={{ opacity: 0.85 }}
          role="button"
          onPress={() => {
            goHome();
          }}
        >
          <Display fontSize={19} letterSpacing={1.4} color={colors.ink}>
            SAVE & CLOSE
          </Display>
        </XStack>
        <XStack
          height={52}
          borderWidth={1}
          borderColor={whiteAlpha(0.18)}
          borderRadius={15}
          alignItems="center"
          justifyContent="center"
          pressStyle={{ opacity: 0.7 }}
          role="button"
          onPress={onRematch}
        >
          <Body fontSize={13} fontWeight="800" letterSpacing={1.4} color={colors.white}>
            REMATCH
          </Body>
        </XStack>
        <Body textAlign="center" fontSize={10.5} fontWeight="600" color={whiteAlpha(0.4)}>
          Saved to this phone · watches updated
        </Body>
      </YStack>
    </YStack>
  );
}

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

function SetChips({
  match,
  snapshot,
}: {
  readonly match: MatchSummary;
  readonly snapshot: MatchSnapshot;
}): ReactNode {
  const chips: ReactNode[] = [];
  for (let setIndex = 0; setIndex < match.config.bestOf; setIndex += 1) {
    const completed = snapshot.completedSets[setIndex];
    const setLabel = `SET ${String(setIndex + 1)}`;
    if (completed !== undefined) {
      chips.push(
        <SetChip
          key={setLabel}
          label={setLabel}
          score={`${String(completed.games.A)}–${String(completed.games.B)}`}
          state="done"
        />,
      );
    } else if (setIndex + 1 === snapshot.setNumber) {
      const game = snapshot.currentGame;
      const isSuperTieBreak = game?.kind === "tieBreak" && game.tieBreakKind === "superTieBreak";
      const score = isSuperTieBreak
        ? `${String(game.points.A)}–${String(game.points.B)}`
        : `${String(snapshot.currentSetGames.A)}–${String(snapshot.currentSetGames.B)}`;
      chips.push(
        <SetChip
          key={setLabel}
          label={isSuperTieBreak ? "SUPER TB" : setLabel}
          score={score}
          state="current"
        />,
      );
    } else {
      chips.push(<SetChip key={setLabel} label={setLabel} score="–" state="future" />);
    }
  }
  return <XStack gap={8}>{chips}</XStack>;
}

export default function LiveScreen(): ReactNode {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const now = useNow(10_000);
  const mutate = useDbMutation();

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
              config: match.config,
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

  const scorePoint = (team: TeamId): void => {
    // A tap that races the match-won swap must not extend the event log.
    if (snapshot.finished) {
      return;
    }
    mutate((driver) => {
      appendEvent(driver, id, { winner: team, at: Date.now() });
    });
  };

  const undoPoint = (): void => {
    if (events.length === 0) {
      return;
    }
    mutate((driver) => {
      removeLastEvent(driver, id);
    });
  };

  const endMatch = (): void => {
    confirmDestructive({
      title: "End match?",
      message: "The match is not finished — discard it?",
      confirmLabel: "Discard match",
      onConfirm: () => {
        mutate((driver) => {
          deleteMatch(driver, id);
        });
        goHome();
      },
    });
  };

  const label = statusLabel(snapshot.moment, names);

  return (
    <YStack
      flex={1}
      backgroundColor={colors.cream}
      paddingTop={insets.top + 10}
      paddingBottom={insets.bottom + 14}
      paddingHorizontal={16}
      gap={12}
    >
      <XStack alignItems="center" justifyContent="space-between">
        <Pill
          backgroundColor={colors.ink}
          paddingVertical={6}
          paddingLeft={9}
          paddingRight={12}
          gap={6}
        >
          <LiveDot size={7} />
          <Body fontSize={11} fontWeight="800" letterSpacing={1.5} color={colors.white}>
            LIVE
          </Body>
        </Pill>
        <Body fontSize={11} fontWeight="700" letterSpacing={1.8} color={inkAlpha(0.55)}>
          {[match.court?.toUpperCase(), `SET ${String(snapshot.setNumber)}`]
            .filter((part): part is string => part !== undefined)
            .join(" · ")}
        </Body>
        <Display fontSize={16}>{durationLabel(now - match.startedAt)}</Display>
      </XStack>

      <SetChips match={match} snapshot={snapshot} />

      <YStack flex={1} gap={10}>
        <TeamCard
          name={names.A}
          point={pointDisplay(snapshot, "A")}
          testID="point-A"
          serving={snapshot.servingTeam === "A"}
          onScore={() => {
            scorePoint("A");
          }}
        />
        <TeamCard
          name={names.B}
          point={pointDisplay(snapshot, "B")}
          testID="point-B"
          serving={snapshot.servingTeam === "B"}
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

      <XStack gap={10}>
        <XStack
          flex={1.4}
          height={58}
          backgroundColor={colors.white}
          borderWidth={1}
          borderColor={inkAlpha(0.08)}
          borderRadius={16}
          alignItems="center"
          justifyContent="center"
          gap={9}
          boxShadow="0 2px 8px rgba(14, 17, 22, 0.05)"
          pressStyle={{ opacity: 0.85 }}
          role="button"
          onPress={undoPoint}
        >
          <Undo size={17} color={colors.ink} />
          <Body fontSize={14} fontWeight="800" letterSpacing={1.4}>
            UNDO
          </Body>
        </XStack>
        <XStack
          flex={1}
          height={58}
          borderWidth={1}
          borderColor={inkAlpha(0.16)}
          borderRadius={16}
          alignItems="center"
          justifyContent="center"
          pressStyle={{ opacity: 0.7 }}
          role="button"
          onPress={endMatch}
        >
          <Body fontSize={13} fontWeight="700" letterSpacing={1.4} color={inkAlpha(0.5)}>
            END MATCH
          </Body>
        </XStack>
      </XStack>

      <XStack alignItems="center" justifyContent="center" gap={6}>
        <LiveDot size={6} />
        <Body fontSize={11} fontWeight="600" color={inkAlpha(0.45)}>
          Synced — 2 watches connected
        </Body>
      </XStack>
    </YStack>
  );
}
