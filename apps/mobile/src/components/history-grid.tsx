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
 * The home screen's season calendar — a GitHub-contribution-graph style grid
 * of the last ten weeks, rebuilt for legibility: 24pt cells, a three-state
 * colour language (won = lime, lost = ink, mixed = outlined), month markers,
 * Mon/Wed/Fri row labels and a streak headline so the card answers "how have
 * I been playing?" without any decoding. Tapping a day with matches expands
 * that day's results beneath the grid.
 */

const CELL = 24;
const GAP = 5;
const AXIS_WIDTH = 20;
const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const;
/** GitHub shows only Mon/Wed/Fri so the axis reads without noise. */
const LABELLED_ROWS = [1, 3, 5] as const;
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

const RADIUS = 7;

/**
 * The day colour is a scale, not a category: 0% wins sits at the opponents'
 * blue, 100% at the brand lime, with the middle blending through a muted
 * green — so a quick glance separates "lost everything" from "won
 * everything" and every shade between is a real win share.
 */
const SCALE_LOST = [46, 91, 255];
const SCALE_WON = [198, 241, 53];

function winShareColor(won: number, lost: number): string {
  const share = won + lost === 0 ? 0 : won / (won + lost);
  const [lr = 0, lg = 0, lb = 0] = SCALE_LOST;
  const [wr = 0, wg = 0, wb = 0] = SCALE_WON;
  const channel = (l: number, w: number): number => Math.round(l + (w - l) * share);
  return `rgb(${String(channel(lr, wr))}, ${String(channel(lg, wg))}, ${String(channel(lb, wb))})`;
}

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

  // Today and the tapped day carry a white ring; everything else speaks
  // through its fill alone.
  const ringed = selected || cell.today;
  const box = (() => {
    if (cell.played === 0) {
      return (
        <View width={CELL} height={CELL} borderRadius={RADIUS} backgroundColor={textAlpha(0.05)} />
      );
    }
    // The whole cell is one shade on the lost→won scale, positioned by the
    // day's win percentage.
    return (
      <View
        width={CELL}
        height={CELL}
        borderRadius={RADIUS}
        backgroundColor={winShareColor(cell.won, cell.lost)}
      />
    );
  })();

  const interactive = cell.played > 0;
  if (!interactive) {
    return (
      <View
        width={CELL}
        height={CELL}
        borderRadius={RADIUS + 2}
        borderWidth={ringed ? 2 : 0}
        borderColor={colors.white}
        alignItems="center"
        justifyContent="center"
      >
        {box}
      </View>
    );
  }
  return (
    <View
      width={CELL}
      height={CELL}
      borderRadius={RADIUS + 2}
      borderWidth={ringed ? 2 : 0}
      borderColor={colors.white}
      alignItems="center"
      justifyContent="center"
      pressStyle={{ opacity: 0.65 }}
      role="button"
      aria-label={`${cell.played} ${cell.played === 1 ? "match" : "matches"} played, ${cell.won} won`}
      onPress={() => {
        onPress(cell.day);
      }}
    >
      {box}
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
  const ownerWon = (match: MatchSummary): boolean => match.winner === ownerTeamOf(match, ownerId);
  const won = dayMatches.filter(ownerWon).length;
  const lost = dayMatches.length - won;
  return (
    <YStack gap={11}>
      <XStack alignItems="center" justifyContent="space-between">
        <Display fontSize={15}>{`${fullDayLabel(day)} · ${String(won)}–${String(lost)}`}</Display>
        <Body
          fontSize={11}
          fontWeight="800"
          letterSpacing={1}
          color={textAlpha(0.45)}
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
            <Body flex={1} fontSize={14.5} fontWeight="700">
              {`vs ${pairLabel(opponentsOf(match, ownerTeam))}`}
            </Body>
            <XStack alignItems="center" gap={12}>
              <Display fontSize={15} color={textAlpha(0.6)}>
                {match.scoreLine ?? ""}
              </Display>
              <ResultBadge won={match.winner === ownerTeam} size={26} />
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
  streak,
  selectedDay,
  onSelectDay,
}: {
  readonly weeks: readonly (readonly DayCell[])[];
  readonly played: number;
  readonly won: number;
  readonly lost: number;
  readonly matches: readonly MatchSummary[];
  readonly ownerId: string;
  readonly streak: { readonly kind: "won" | "lost"; readonly count: number } | undefined;
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
    <Card borderRadius={22} paddingVertical={16} paddingHorizontal={16} gap={14}>
      <XStack alignItems="center" justifyContent="space-between">
        <YStack>
          <Overline>YOUR SEASON</Overline>
          <Display fontSize={17}>{`${String(won)}W · ${String(lost)}L`}</Display>
        </YStack>
        {streak === undefined ? null : (
          <XStack
            backgroundColor={colors.ink}
            borderRadius={14}
            paddingVertical={9}
            paddingHorizontal={14}
            alignItems="center"
            gap={8}
          >
            <Display fontSize={14} color={streak.kind === "won" ? colors.lime : colors.white}>
              {streak.kind === "won"
                ? `Won last ${String(streak.count)}`
                : `Lost last ${String(streak.count)}`}
            </Display>
          </XStack>
        )}
      </XStack>

      <ScrollView horizontal={true} showsHorizontalScrollIndicator={false}>
        <YStack gap={4}>
          <XStack paddingLeft={AXIS_WIDTH} gap={GAP}>
            {monthMarkers.map((label, index) => (
              <View key={`month-${String(weeks[index]?.[0]?.day)}`} width={CELL * 2}>
                <Body fontSize={10} fontWeight="800" color={textAlpha(0.4)} numberOfLines={1}>
                  {label}
                </Body>
              </View>
            ))}
          </XStack>
          <XStack gap={GAP}>
            <YStack justifyContent="space-between" width={AXIS_WIDTH} paddingVertical={2}>
              {DAY_LABELS.map((label, index) => (
                <Body
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed 7-slot axis
                  key={index}
                  fontSize={10}
                  fontWeight="700"
                  color={textAlpha(0.35)}
                  lineHeight={CELL}
                  opacity={(LABELLED_ROWS as readonly number[]).includes(index) ? 1 : 0}
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

      <XStack alignItems="center" justifyContent="center" gap={10}>
        <Body fontSize={11} fontWeight="700" color={textAlpha(0.5)}>
          0%
        </Body>
        {[0, 0.25, 0.5, 0.75, 1].map((share) => (
          <View
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed 5-stop scale
            key={share}
            width={15}
            height={13}
            borderRadius={4}
            backgroundColor={winShareColor(share, 1 - share)}
          />
        ))}
        <Body fontSize={11} fontWeight="700" color={textAlpha(0.5)}>
          100% won
        </Body>
        <Body fontSize={11} fontWeight="700" color={textAlpha(0.35)}>
          {`· ${String(played)} played`}
        </Body>
      </XStack>

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
