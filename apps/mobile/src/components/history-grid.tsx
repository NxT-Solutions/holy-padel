import type { ReactNode } from "react";
import { View, XStack, YStack } from "tamagui";
import { Body, Card, Display, Overline } from "@/components/ui.tsx";
import type { DayCell } from "@/lib/history.ts";
import { colors, textAlpha } from "@/theme/colors.ts";

/**
 * The home screen's season grid: one small square per day for the last few
 * weeks — lime when you won, ink when you lost, outlined for a mixed day —
 * a calendar-shaped answer to "how have I been playing?".
 */

const CELL = 13;
const GAP = 3;
const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const;

function DaySquare({ cell }: { readonly cell: DayCell }): ReactNode {
  if (cell.future) {
    return <View width={CELL} height={CELL} />;
  }
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
}

export function HistoryGrid({
  weeks,
  played,
  won,
  lost,
}: {
  readonly weeks: readonly (readonly DayCell[])[];
  readonly played: number;
  readonly won: number;
  readonly lost: number;
}): ReactNode {
  if (played === 0) {
    return null;
  }
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

      <XStack gap={6} alignSelf="center">
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
                <DaySquare key={String(cell.day)} cell={cell} />
              ))}
            </YStack>
          ))}
        </XStack>
      </XStack>

      <Display fontSize={13} textAlign="center" color={textAlpha(0.5)}>
        {`${String(played)} ${played === 1 ? "match" : "matches"} played`}
      </Display>
    </Card>
  );
}
