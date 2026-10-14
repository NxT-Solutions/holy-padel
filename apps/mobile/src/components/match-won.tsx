import type { MatchSummary } from "@holy-padel/db";
import type { MatchSnapshot, MatchStats, TeamId } from "@holy-padel/scoring";
import type { ReactNode } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack } from "tamagui";
import { FloodlightGlow } from "@/components/court-art.tsx";
import { Body, Display } from "@/components/ui.tsx";
import { dayLabel, durationLabel, finalScoreLine, teamNames } from "@/lib/format.ts";
import { colors, whiteAlpha } from "@/theme/colors.ts";

/**
 * The victory screen — final line, headline totals, done/rematch. The result
 * is already saved by the deciding rally, so DONE only leaves (and dismisses
 * the watches' MATCH WON). UNDO LAST POINT
 * reopens the match after a mis-tapped match point; it's omitted when another
 * match has gone live meanwhile.
 */
export function MatchWon({
  match,
  snapshot,
  stats,
  now,
  ownerId,
  onDone,
  onRematch,
  onUndo,
}: {
  readonly match: MatchSummary;
  readonly snapshot: MatchSnapshot;
  readonly stats: MatchStats;
  readonly now: number;
  readonly ownerId: string;
  readonly onDone: () => void;
  readonly onRematch: () => void;
  readonly onUndo?: () => void;
}): ReactNode {
  const insets = useSafeAreaInsets();
  const winner = snapshot.winner ?? "A";
  const loser: TeamId = winner === "A" ? "B" : "A";
  const names = teamNames(match);
  const ownerTeam: TeamId = match.players.B.includes(ownerId) ? "B" : "A";
  const ownerWon = winner === ownerTeam;
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
      position="relative"
      overflow="hidden"
    >
      <View position="absolute" top={0} left={0} right={0} height="55%" pointerEvents="none">
        <FloodlightGlow color={colors.accent} opacity={0.22} />
      </View>
      <Body fontSize={11} fontWeight="800" letterSpacing={2} color={whiteAlpha(0.45)}>
        {meta}
      </Body>
      <Display fontSize={58} color={colors.accent} letterSpacing={1} marginTop={14}>
        {ownerWon ? "MATCH WON" : "MATCH LOST"}
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
      <Display fontSize={76} color={colors.white} marginTop={22} testID="won-score">
        {finalScoreLine(snapshot)}
      </Display>
      <XStack gap={8} marginTop={26} width="100%">
        <StatTile
          value={`${String(snapshot.totalGames[winner])}–${String(snapshot.totalGames[loser])}`}
          label="GAMES"
        />
        <StatTile
          value={`${String(snapshot.totalPoints[winner])}–${String(snapshot.totalPoints[loser])}`}
          label="POINTS"
        />
        {match.config.sport === "squash" ? (
          <StatTile
            value={stats.longestRun === undefined ? "0" : String(stats.longestRun.count)}
            label="LONGEST RUN"
          />
        ) : (
          <StatTile value={String(stats.breaks[winner])} label="BREAKS" />
        )}
      </XStack>
      <YStack marginTop="auto" width="100%" gap={9}>
        <XStack
          height={60}
          backgroundColor={colors.accent}
          borderRadius={17}
          alignItems="center"
          justifyContent="center"
          pressStyle={{ opacity: 0.85 }}
          role="button"
          onPress={onDone}
        >
          <Display fontSize={19} letterSpacing={1.4} color={colors.onAccent}>
            DONE
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
        {onUndo === undefined ? null : (
          <XStack
            height={40}
            alignItems="center"
            justifyContent="center"
            pressStyle={{ opacity: 0.6 }}
            role="button"
            aria-label="Undo last point"
            onPress={onUndo}
            testID="won-undo"
          >
            <Body fontSize={12} fontWeight="800" letterSpacing={1.4} color={whiteAlpha(0.6)}>
              UNDO LAST POINT
            </Body>
          </XStack>
        )}
        <Body textAlign="center" fontSize={10.5} fontWeight="600" color={whiteAlpha(0.4)}>
          Saved to this phone · watches updated
        </Body>
      </YStack>
    </YStack>
  );
}

function StatTile({ value, label }: { readonly value: string; readonly label: string }): ReactNode {
  return (
    <YStack
      flex={1}
      backgroundColor={colors.inkRaised}
      borderRadius={16}
      paddingVertical={12}
      alignItems="center"
    >
      <Display fontSize={22} color={colors.white}>
        {value}
      </Display>
      <Body
        fontSize={9}
        fontWeight="800"
        letterSpacing={1.4}
        color={whiteAlpha(0.45)}
        marginTop={2}
      >
        {label}
      </Body>
    </YStack>
  );
}
