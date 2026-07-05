import type { MatchSummary } from "@holy-padel/db";
import type { MatchSnapshot, MatchStats, TeamId } from "@holy-padel/scoring";
import type { ReactNode } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { XStack, YStack } from "tamagui";
import { Body, Display } from "@/components/ui.tsx";
import { dayLabel, durationLabel, finalScoreLine, teamNames } from "@/lib/format.ts";
import { goHome } from "@/lib/navigation.ts";
import { colors, whiteAlpha } from "@/theme/colors.ts";

/** The victory screen — final line, headline totals, save/rematch. */
export function MatchWon({
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
      <Display fontSize={58} color={colors.lime} letterSpacing={1} marginTop={14}>
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
        <StatTile value={String(stats.breaks[winner])} label="BREAKS" />
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
