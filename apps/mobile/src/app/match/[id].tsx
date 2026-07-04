import { deleteMatch, getMatch, loadEvents } from "@holy-padel/db";
import type { SetStats, TeamId } from "@holy-padel/scoring";
import { computeMatch, computeStats } from "@holy-padel/scoring";
import { Redirect, useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";
import { ScrollView, Share } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack } from "tamagui";
import { ChevronLeft } from "@/components/icons.tsx";
import { Body, Card, Display, Overline, Pill } from "@/components/ui.tsx";
import { useDbMutation, useDbQuery } from "@/db/provider.tsx";
import { confirmDestructive } from "@/lib/confirm.ts";
import { durationLabel, fullDayLabel, pairInitials, teamNames, timeLabel } from "@/lib/format.ts";
import { goBack } from "@/lib/navigation.ts";
import { colors, inkAlpha, whiteAlpha } from "@/theme/colors.ts";

const DEUCE_LABELS: Record<string, string> = {
  advantage: "ADVANTAGE",
  goldenPoint: "GOLDEN POINT",
  starPoint: "STAR POINT",
};

function setNote(set: SetStats): string {
  if (set.summary.kind === "superTieBreak") {
    return "Super tie-break";
  }
  if (set.summary.tieBreak !== undefined) {
    const { A, B } = set.summary.tieBreak;
    return `Tie-break ${String(Math.max(A, B))}–${String(Math.min(A, B))}`;
  }
  const lastBreak = set.breakGames.at(-1);
  if (lastBreak !== undefined) {
    return `Break in game ${String(lastBreak.gameNumber)}`;
  }
  return "Serve held throughout";
}

export default function MatchOverviewScreen(): ReactNode {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const mutate = useDbMutation();

  const match = useDbQuery((driver) => getMatch(driver, id));
  const events = useDbQuery((driver) => loadEvents(driver, id));

  if (match === undefined) {
    // Deleted or unknown match (stale link, back after delete): recover home.
    return <Redirect href="/" />;
  }
  if (match.status === "live") {
    // The overview is for finished matches — a live one belongs on the scoreboard.
    return <Redirect href={`/live/${match.id}`} />;
  }

  const snapshot = computeMatch(match.config, events);
  const stats = computeStats(match.config, events);
  const names = teamNames(match);
  const winner: TeamId = match.winner ?? snapshot.winner ?? "A";
  const loser: TeamId = winner === "A" ? "B" : "A";
  const initials = { A: pairInitials(match.names.A), B: pairInitials(match.names.B) };

  const pointsWinner = snapshot.totalPoints[winner];
  const pointsLoser = snapshot.totalPoints[loser];
  const pointsTotal = pointsWinner + pointsLoser;
  const winnerShare = pointsTotal === 0 ? 50 : (pointsWinner / pointsTotal) * 100;

  const service = stats.service[winner];
  const longest = stats.longestGame;

  const confirmDelete = (): void => {
    confirmDestructive({
      title: "Delete match?",
      message: "This removes the match and its points from this phone.",
      confirmLabel: "Delete",
      onConfirm: () => {
        mutate((driver) => {
          deleteMatch(driver, id);
        });
        goBack();
      },
    });
  };

  const exportMatch = (): void => {
    void Share.share({
      message: `${names[winner]} def. ${names[loser]} ${match.scoreLine ?? ""} · ${durationLabel(stats.durationMs)}`,
    });
  };

  return (
    <ScrollView
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 24,
        gap: 13,
      }}
      style={{ backgroundColor: colors.cream }}
    >
      <XStack alignItems="center" justifyContent="space-between">
        <View
          width={38}
          height={38}
          borderRadius={19}
          backgroundColor={colors.white}
          alignItems="center"
          justifyContent="center"
          boxShadow="0 2px 8px rgba(14, 17, 22, 0.08)"
          pressStyle={{ opacity: 0.8 }}
          role="button"
          aria-label="Back"
          onPress={() => {
            goBack();
          }}
        >
          <ChevronLeft size={15} color={colors.ink} />
        </View>
        <Body fontSize={11} fontWeight="800" letterSpacing={1.6} color={inkAlpha(0.45)}>
          {[fullDayLabel(match.startedAt), timeLabel(match.startedAt), match.court?.toUpperCase()]
            .filter((part): part is string => part !== undefined)
            .join(" · ")}
        </Body>
        <View width={38} />
      </XStack>

      <YStack
        backgroundColor={colors.ink}
        borderRadius={22}
        paddingVertical={22}
        paddingHorizontal={20}
        alignItems="center"
      >
        <Display fontSize={26} color={colors.white}>
          {names[winner].toUpperCase()}
        </Display>
        <Body
          fontSize={10}
          fontWeight="800"
          letterSpacing={1.6}
          color={whiteAlpha(0.4)}
          marginTop={4}
        >
          {`DEF. ${names[loser].toUpperCase()}`}
        </Body>
        <Display
          fontSize={58}
          lineHeight={60}
          color={colors.lime}
          marginTop={12}
          testID="overview-score"
        >
          {match.scoreLine ?? ""}
        </Display>
        <Body
          fontSize={11}
          fontWeight="700"
          letterSpacing={1.4}
          color={whiteAlpha(0.45)}
          marginTop={10}
        >
          {`${durationLabel(stats.durationMs)} · BEST OF ${String(match.config.bestOf)} · ${DEUCE_LABELS[match.config.deuceMode] ?? ""}`}
        </Body>
      </YStack>

      <YStack gap={8}>
        {stats.sets.map((set) => (
          <Card
            key={set.setNumber}
            borderRadius={17}
            paddingVertical={14}
            paddingHorizontal={17}
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <YStack gap={3}>
              <Overline letterSpacing={1.4}>
                {`SET ${String(set.setNumber)} · ${String(Math.round(set.durationMs / 60_000))} MIN`}
              </Overline>
              <Body fontSize={13} fontWeight="700" color={inkAlpha(0.55)}>
                {setNote(set)}
              </Body>
            </YStack>
            <XStack alignItems="center" gap={11}>
              <Display fontSize={26}>
                {`${String(set.summary.games.A)}–${String(set.summary.games.B)}`}
              </Display>
              <Pill
                backgroundColor={colors.lime}
                borderRadius={7}
                paddingVertical={4}
                paddingHorizontal={8}
              >
                <Display fontSize={11} letterSpacing={0.5} color={colors.ink}>
                  {initials[set.summary.winner]}
                </Display>
              </Pill>
            </XStack>
          </Card>
        ))}
      </YStack>

      <Card borderRadius={20} paddingVertical={16} paddingHorizontal={17} gap={13}>
        <Overline>MATCH TOTALS</Overline>
        <YStack gap={6}>
          <XStack alignItems="center" justifyContent="space-between">
            <Display fontSize={16}>{String(pointsWinner)}</Display>
            <Body fontSize={10} fontWeight="800" letterSpacing={1.3} color={inkAlpha(0.4)}>
              POINTS WON
            </Body>
            <Display fontSize={16} color={inkAlpha(0.45)}>
              {String(pointsLoser)}
            </Display>
          </XStack>
          <XStack height={8} borderRadius={999} overflow="hidden" gap={2}>
            <View flex={winnerShare} backgroundColor={colors.lime} />
            <View flex={100 - winnerShare} backgroundColor={colors.greige} />
          </XStack>
        </YStack>
        {longest === undefined ? null : (
          <XStack alignItems="center" justifyContent="space-between">
            <Body fontSize={13} fontWeight="700">
              Longest game
            </Body>
            <Display fontSize={15}>
              {/* biome-ignore lint/nursery/noUselessTypeConversion: the operands are numbers; the rule misreads the sum as a string */}
              {`${String(longest.points.A + longest.points.B)} POINTS · GAME ${String(
                longest.gameNumber,
              )}`}
            </Display>
          </XStack>
        )}
        <XStack alignItems="center" justifyContent="space-between">
          <Body fontSize={13} fontWeight="700">
            Service games held
          </Body>
          <Display fontSize={15}>{`${String(service.held)} / ${String(service.served)}`}</Display>
        </XStack>
      </Card>

      <XStack alignItems="center" justifyContent="center" gap={18} marginTop={8}>
        <Body
          fontSize={11}
          fontWeight="800"
          letterSpacing={1.3}
          color={inkAlpha(0.45)}
          pressStyle={{ opacity: 0.6 }}
          role="button"
          onPress={exportMatch}
        >
          EXPORT
        </Body>
        <View width={3} height={3} borderRadius={2} backgroundColor={inkAlpha(0.25)} />
        <Body
          fontSize={11}
          fontWeight="800"
          letterSpacing={1.3}
          color={colors.danger}
          pressStyle={{ opacity: 0.6 }}
          role="button"
          onPress={confirmDelete}
        >
          DELETE MATCH
        </Body>
      </XStack>
    </ScrollView>
  );
}
