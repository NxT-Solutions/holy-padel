import type { MatchSummary } from "@holy-padel/db";
import {
  computeProfileStats,
  createMatch,
  getLiveMatch,
  getOwner,
  listMatches,
  loadEvents,
} from "@holy-padel/db";
import type { MatchSnapshot } from "@holy-padel/scoring";
import { computeMatch } from "@holy-padel/scoring";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack } from "tamagui";
import { ArrowRight, Plus } from "@/components/icons.tsx";
import {
  Avatar,
  Body,
  Card,
  Display,
  LiveDot,
  Overline,
  Pill,
  ResultBadge,
} from "@/components/ui.tsx";
import { useDbMutation, useDbQuery } from "@/db/provider.tsx";
import {
  durationLabel,
  liveScoreLine,
  matchMetaLabel,
  opponentsOf,
  ownerTeamOf,
  pairInitials,
  pairLabel,
} from "@/lib/format.ts";
import { useNow } from "@/lib/use-now.ts";
import { colors, inkAlpha, whiteAlpha } from "@/theme/colors.ts";

function pointCallOf(snapshot: MatchSnapshot, team: "A" | "B"): string {
  const game = snapshot.currentGame;
  if (game === undefined) {
    return "";
  }
  return game.kind === "standard" ? game.calls[team] : String(game.points[team]);
}

function LiveCard({
  match,
  snapshot,
  now,
}: {
  readonly match: MatchSummary;
  readonly snapshot: MatchSnapshot;
  readonly now: number;
}): ReactNode {
  const clock = durationLabel(now - match.startedAt);
  const meta = [`SET ${String(snapshot.setNumber)}`, clock, match.court?.toUpperCase()]
    .filter((part): part is string => part !== undefined)
    .join(" · ");
  return (
    <View backgroundColor={colors.ink} borderRadius={22} padding={18} gap={12}>
      <XStack alignItems="center" justifyContent="space-between">
        <XStack alignItems="center" gap={6}>
          <LiveDot size={7} />
          <Body fontSize={11} fontWeight="800" letterSpacing={1.5} color={colors.lime}>
            LIVE NOW
          </Body>
        </XStack>
        <Body fontSize={11} fontWeight="700" letterSpacing={1.4} color={whiteAlpha(0.5)}>
          {meta}
        </Body>
      </XStack>
      <XStack alignItems="center" justifyContent="space-between">
        <YStack gap={8}>
          <XStack alignItems="flex-end" gap={12}>
            <Display fontSize={22} color={colors.white} width={64}>
              {pairInitials(match.names.A)}
            </Display>
            <Display fontSize={40} lineHeight={38} color={colors.lime}>
              {pointCallOf(snapshot, "A")}
            </Display>
          </XStack>
          <XStack alignItems="flex-end" gap={12}>
            <Display fontSize={22} color={colors.white} width={64}>
              {pairInitials(match.names.B)}
            </Display>
            <Display fontSize={40} lineHeight={38} color={colors.white}>
              {pointCallOf(snapshot, "B")}
            </Display>
          </XStack>
        </YStack>
        <YStack alignItems="flex-end">
          <Overline color={whiteAlpha(0.4)}>SETS</Overline>
          <Display fontSize={26} color={colors.white} marginTop={3}>
            {liveScoreLine(snapshot)}
          </Display>
        </YStack>
      </XStack>
      <XStack
        height={48}
        backgroundColor={colors.lime}
        borderRadius={14}
        alignItems="center"
        justifyContent="center"
        gap={9}
        pressStyle={{ opacity: 0.85 }}
        role="button"
        onPress={() => {
          router.push(`/live/${match.id}`);
        }}
      >
        <Display fontSize={16} letterSpacing={1.4} color={colors.ink}>
          RESUME SCORING
        </Display>
        <ArrowRight size={15} color={colors.ink} />
      </XStack>
    </View>
  );
}

function RecentRow({
  match,
  now,
}: {
  readonly match: MatchSummary;
  readonly now: number;
}): ReactNode {
  const ownerTeam = ownerTeamOf(match, "nico");
  const won = match.winner === ownerTeam;
  return (
    <Card
      borderRadius={16}
      paddingVertical={13}
      paddingHorizontal={16}
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
      pressStyle={{ opacity: 0.9 }}
      role="button"
      onPress={() => {
        router.push(`/match/${match.id}`);
      }}
    >
      <Body fontSize={12.5} fontWeight="700">
        {`${matchMetaLabel(match, now).split(" · ")[0] ?? ""} · vs ${pairLabel(opponentsOf(match, ownerTeam))}`}
      </Body>
      <XStack alignItems="center" gap={10}>
        <Display fontSize={14} color={inkAlpha(0.6)} letterSpacing={0.5}>
          {match.scoreLine ?? ""}
        </Display>
        <ResultBadge won={won} size={24} />
      </XStack>
    </Card>
  );
}

export default function HomeScreen(): ReactNode {
  const insets = useSafeAreaInsets();
  const now = useNow();
  const mutate = useDbMutation();

  const owner = useDbQuery(getOwner);
  const live = useDbQuery(getLiveMatch);
  const liveSnapshot = useDbQuery((driver) =>
    live === undefined ? undefined : computeMatch(live.config, loadEvents(driver, live.id)),
  );
  const stats = useDbQuery((driver) => computeProfileStats(driver, "nico"));
  const recent = useDbQuery((driver) =>
    listMatches(driver)
      .filter((match) => match.status === "finished")
      .slice(0, 2),
  );
  const [lastFinished] = recent;

  const startRematch = (): void => {
    if (lastFinished === undefined) {
      return;
    }
    const id = `match-${String(Date.now())}`;
    mutate((driver) => {
      createMatch(driver, {
        id,
        config: lastFinished.config,
        players: lastFinished.players,
        ...(lastFinished.court === undefined ? {} : { court: lastFinished.court }),
        ...(lastFinished.location === undefined ? {} : { location: lastFinished.location }),
        startedAt: Date.now(),
      });
    });
    router.push(`/live/${id}`);
  };

  return (
    <ScrollView
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 90,
        gap: 12,
      }}
    >
      <XStack alignItems="center" gap={12}>
        <Avatar letter={owner?.name.charAt(0) ?? "N"} size={44} />
        <YStack flex={1}>
          <Overline letterSpacing={1.6}>{owner?.club ?? "Holy Padel"}</Overline>
          <Display fontSize={24}>{`HOLA, ${(owner?.name ?? "").toUpperCase()}`}</Display>
        </YStack>
        <Pill
          borderWidth={1}
          borderColor={inkAlpha(0.14)}
          paddingVertical={7}
          paddingHorizontal={12}
          gap={6}
        >
          <LiveDot size={6} />
          <Body fontSize={10} fontWeight="800" letterSpacing={1.2} color={inkAlpha(0.55)}>
            WATCH PAIRED
          </Body>
        </Pill>
      </XStack>

      {live !== undefined && liveSnapshot !== undefined ? (
        <LiveCard match={live} snapshot={liveSnapshot} now={now} />
      ) : null}

      <XStack gap={8}>
        <XStack
          flex={1.5}
          height={58}
          backgroundColor={colors.white}
          borderWidth={2}
          borderColor={colors.ink}
          borderRadius={16}
          alignItems="center"
          justifyContent="center"
          gap={9}
          boxShadow="0 2px 10px rgba(14, 17, 22, 0.06)"
          pressStyle={{ opacity: 0.85 }}
          role="button"
          onPress={() => {
            router.push("/new-match");
          }}
        >
          <Plus size={14} color={colors.ink} />
          <Display fontSize={16} letterSpacing={1.2}>
            NEW MATCH
          </Display>
        </XStack>
        <YStack
          flex={1}
          height={58}
          borderWidth={1}
          borderColor={inkAlpha(0.16)}
          borderRadius={16}
          alignItems="center"
          justifyContent="center"
          gap={2}
          pressStyle={{ opacity: 0.7 }}
          role="button"
          onPress={startRematch}
        >
          <Body fontSize={10} fontWeight="800" letterSpacing={1.2} color={inkAlpha(0.5)}>
            REMATCH
          </Body>
          <Body fontSize={10.5} fontWeight="700" color={inkAlpha(0.4)}>
            {lastFinished === undefined
              ? "no matches yet"
              : `vs ${pairLabel(opponentsOf(lastFinished, ownerTeamOf(lastFinished, "nico")))}`}
          </Body>
        </YStack>
      </XStack>

      <Card
        borderRadius={18}
        paddingVertical={14}
        paddingHorizontal={17}
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
      >
        <Overline>FORM</Overline>
        <XStack gap={6}>
          {stats.form.map((won, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the strip is positional by design
            <ResultBadge key={index} won={won} size={24} />
          ))}
        </XStack>
        <Display
          fontSize={16}
        >{`${String(stats.record.won)}–${String(stats.record.lost)}`}</Display>
      </Card>

      <YStack gap={8}>
        {recent.map((match) => (
          <RecentRow key={match.id} match={match} now={now} />
        ))}
      </YStack>
    </ScrollView>
  );
}
