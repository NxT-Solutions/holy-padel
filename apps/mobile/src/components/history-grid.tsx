import type { MatchSummary } from "@holy-padel/db";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { ScrollView } from "react-native";
import { View, XStack, YStack } from "tamagui";
import { Body, Card, Display, Overline, ResultBadge } from "@/components/ui.tsx";
import { fullDayLabel, opponentsOf, ownerTeamOf, pairLabel } from "@/lib/format.ts";
import type { DayCell } from "@/lib/history.ts";
import { colors, textAlpha } from "@/theme/colors.ts";

/**
 * The home screen's season grid: one small square per day for the last few
 * weeks — lime when you won, ink when you lost, outlined for a mixed day —
 * with month markers and today ringed. Tapping a day with matches expands
 * that day's results right below the grid.
 */

const CELL = 13;
const GAP = 3;
const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const;
const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const;

function DaySquare({
  cell,
  selected,
  onPress,
}: {
  readonly cell: DayCell;
  readonly selected: boolean;
  readonly onPress: (day: number) => void;
}): ReactNode {
  if (cell.future) {
    return <View width={CELL} height={CELL} />;
  }
  const interactive = cell.played > 0;
  const ring = (() => {
    if (selected) {
      return colors.white;
    }
    return cell.today ? colors.lime : "transparent";
  })();
  const inner = (() => {
    if (cell.played === 0) {
      return <View width={CELL} height={CELL} borderRadius={4} backgroundColor={textAlpha(0.04)} />;
    }
    const mixed = cell.won > 0 && cell.lost > 0;
    const wonDay = cell.won > cell.lost;
    if (mixed) {
      return (
        <View
          width={CELL}
          height={CELL}
          borderRadius={4}
          backgroundColor={textAlpha(0.14)}
          borderWidth={1}
          borderColor={wonDay ? colors.lime : textAlpha(0.2)}
        />
      );
    }
    return (
      <View
        width={CELL}
        height={CELL}
        borderRadius={4}
        backgroundColor={wonDay ? colors.lime : colors.ink}
      />
    );
  })();
  if (!interactive) {
    return (
      <View
        width={CELL}
        height={CELL}
        borderRadius={5}
        borderWidth={selected || cell.today ? 1 : 0}
        borderColor={ring}
        alignItems="center"
        justifyContent="center"
      >
        {inner}
      </View>
    );
  }
  return (
    <View
      width={CELL}
      height={CELL}
      borderRadius={5}
      borderWidth={selected || cell.today ? 1 : 0}
      borderColor={ring}
      alignItems="center"
      justifyContent="center"
      pressStyle={{ opacity: 0.6 }}
      role="button"
      aria-label={`${cell.played} ${cell.played === 1 ? "match" : "matches"} played`}
      onPress={() => {
        onPress(cell.day);
      }}
    >
      {inner}
    </View>
  );
}

/** The results of the selected day, listed under the grid. */
function DayMatches({
  day,
  matches,
  ownerId,
  onDismiss,
}: {
  readonly day: number;
  readonly matches: readonly MatchSummary[];
  readonly ownerId: string;
  readonly onDismiss: () => void;
}): ReactNode {
  const dayMatches = matches.filter(
    (match) => match.startedAt >= day && match.startedAt < day + 86_400_000,
  );
  const ownerWon = (match: MatchSummary): boolean => {
    const ownerTeam = ownerTeamOf(match, ownerId);
    return match.winner === ownerTeam;
  };
  const won = dayMatches.filter(ownerWon).length;
  const lost = dayMatches.length - won;
  return (
    <YStack gap={9}>
      <XStack alignItems="center" justifyContent="space-between">
        <Body fontSize={12} fontWeight="800" letterSpacing={1.2} color={textAlpha(0.6)}>
          {`${fullDayLabel(day)} · ${String(won)}–${String(lost)}`}
        </Body>
        <Body
          fontSize={10.5}
          fontWeight="800"
          letterSpacing={1}
          color={textAlpha(0.4)}
          pressStyle={{ opacity: 0.6 }}
          role="button"
          onPress={onDismiss}
        >
          CLOSE
        </Body>
      </XStack>
      {dayMatches.map((match) => {
        const ownerTeam = ownerTeamOf(match, ownerId);
        return (
          <XStack
            key={match.id}
            alignItems="center"
            justifyContent="space-between"
            pressStyle={{ opacity: 0.85 }}
            role="button"
            onPress={() => {
              router.push(`/match/${match.id}`);
            }}
          >
            <Body flex={1} fontSize={13.5} fontWeight="700">
              {`vs ${pairLabel(opponentsOf(match, ownerTeam))}`}
            </Body>
            <XStack alignItems="center" gap={10}>
              <Display fontSize={14} color={textAlpha(0.6)}>
                {match.scoreLine ?? ""}
              </Display>
              <ResultBadge won={match.winner === ownerTeam} size={22} />
            </XStack>
          </XStack>
        );
      })}
    </YStack>
  );
}

export function HistoryGrid({
  weeks,
  played,
  won,
  lost,
  matches,
  ownerId,
  selectedDay,
  onSelectDay,
}: {
  readonly weeks: readonly (readonly DayCell[])[];
  readonly played: number;
  readonly won: number;
  readonly lost: number;
  readonly matches: readonly MatchSummary[];
  readonly ownerId: string;
  readonly selectedDay: number | undefined;
  readonly onSelectDay: (day: number | undefined) => void;
}): ReactNode {
  if (played === 0) {
    return null;
  }
  const handleSelect = (day: number): void => {
    onSelectDay(selectedDay === day ? undefined : day);
  };
  // A month marker sits above the first column that starts a new month.
  const monthMarkers = weeks.map((week, index) => {
    const { day } = week[0] ?? {};
    if (day === undefined) {
      return "";
    }
    const previous = weeks[index - 1]?.[0];
    const previousMonth = previous === undefined ? undefined : new Date(previous.day).getMonth();
    const month = new Date(day).getMonth();
    if (previousMonth === month && previous?.future === week[0]?.future) {
      return "";
    }
    return MONTHS[month] ?? "";
  });

  return (
    <Card borderRadius={20} paddingVertical={15} paddingHorizontal={17} gap={12}>
      <XStack alignItems="center" justifyContent="space-between">
        <Overline>{`LAST ${String(weeks.length)} WEEKS`}</Overline>
        <XStack alignItems="center" gap={10}>
          <XStack alignItems="center" gap={5}>
            <View width={9} height={9} borderRadius={3} backgroundColor={colors.lime} />
            <Body fontSize={10} fontWeight="700" color={textAlpha(0.45)}>
              {`${String(won)} W`}
            </Body>
          </XStack>
          <XStack alignItems="center" gap={5}>
            <View width={9} height={9} borderRadius={3} backgroundColor={colors.ink} />
            <Body fontSize={10} fontWeight="700" color={textAlpha(0.45)}>
              {`${String(lost)} L`}
            </Body>
          </XStack>
        </XStack>
      </XStack>

      <ScrollView horizontal={true} showsHorizontalScrollIndicator={false}>
        <YStack gap={3}>
          <XStack paddingLeft={16} gap={GAP}>
            {monthMarkers.map((label, index) => (
              <View key={`month-${String(weeks[index]?.[0]?.day)}`} width={CELL * 2}>
                <Body fontSize={8} fontWeight="800" color={textAlpha(0.35)} numberOfLines={1}>
                  {label}
                </Body>
              </View>
            ))}
          </XStack>
          <XStack gap={6}>
            <YStack justifyContent="space-between" paddingVertical={1}>
              {DAY_LABELS.map((label, index) => (
                <Body
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed 7-slot axis
                  key={index}
                  width={10}
                  fontSize={8}
                  fontWeight="700"
                  color={textAlpha(0.3)}
                  lineHeight={CELL}
                >
                  {label}
                </Body>
              ))}
            </YStack>
            <XStack gap={GAP}>
              {weeks.map((week) => (
                <YStack key={String(week[0]?.day)} gap={GAP}>
                  {week.map((cell) => (
                    <DaySquare
                      key={String(cell.day)}
                      cell={cell}
                      selected={cell.day === selectedDay}
                      onPress={handleSelect}
                    />
                  ))}
                </YStack>
              ))}
            </XStack>
          </XStack>
        </YStack>
      </ScrollView>

      <Display fontSize={13} textAlign="center" color={textAlpha(0.5)}>
        {`${String(played)} ${played === 1 ? "match" : "matches"} played`}
      </Display>

      {selectedDay === undefined ? null : (
        <DayMatches
          day={selectedDay}
          matches={matches}
          ownerId={ownerId}
          onDismiss={() => {
            onSelectDay(undefined);
          }}
        />
      )}
    </Card>
  );
}
