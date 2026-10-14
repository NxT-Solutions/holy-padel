import type { HeartRateSample, MotionSample } from "@holy-padel/db";
import type { ReactNode } from "react";
import { XStack, YStack } from "tamagui";
import { Body, Card, Display, Overline } from "@/components/ui.tsx";
import { activityIn, distanceLabel, matchWindow } from "@/lib/game-activity.ts";
import type { GameSeries } from "@/lib/game-series.ts";
import { textAlpha } from "@/theme/colors.ts";

function Figure({ value, label }: { readonly value: string; readonly label: string }): ReactNode {
  return (
    <YStack flex={1} alignItems="center" gap={2}>
      <Display fontSize={20}>{value}</Display>
      <Body fontSize={8.5} fontWeight="800" letterSpacing={1.2} color={textAlpha(0.4)}>
        {label}
      </Body>
    </YStack>
  );
}

/**
 * The whole match as the watch measured it: heart rate, steps and distance,
 * plus steps per game. Hidden when the match wasn't tracked on a watch.
 */
export function MatchActivityCard({
  series,
  matchStartedAt,
  heartRate,
  motion,
}: {
  readonly series: readonly GameSeries[];
  readonly matchStartedAt: number;
  readonly heartRate: readonly HeartRateSample[] | undefined;
  readonly motion: readonly MotionSample[] | undefined;
}): ReactNode {
  const window = matchWindow(series, matchStartedAt);
  if (window === undefined) {
    return null;
  }
  const total = activityIn(window, heartRate, motion);
  const figures = [
    ...(total.avgBpm === undefined ? [] : [{ value: String(total.avgBpm), label: "AVG BPM" }]),
    ...(total.maxBpm === undefined ? [] : [{ value: String(total.maxBpm), label: "PEAK BPM" }]),
    ...(total.steps === undefined ? [] : [{ value: total.steps.toLocaleString(), label: "STEPS" }]),
    ...(total.meters === undefined
      ? []
      : [{ value: distanceLabel(total.meters), label: "DISTANCE" }]),
  ];
  if (figures.length === 0) {
    return null;
  }
  const perGame =
    total.steps === undefined || series.length === 0
      ? undefined
      : Math.round(total.steps / series.length);
  return (
    <Card
      borderRadius={20}
      paddingVertical={16}
      paddingHorizontal={17}
      gap={13}
      testID="match-activity"
    >
      <XStack alignItems="center" justifyContent="space-between">
        <Overline>ON YOUR WATCH</Overline>
        {perGame === undefined ? null : (
          <Body fontSize={10} fontWeight="800" letterSpacing={1.2} color={textAlpha(0.4)}>
            {`${perGame.toLocaleString()} STEPS / GAME`}
          </Body>
        )}
      </XStack>
      <XStack>
        {figures.map((figure) => (
          <Figure key={figure.label} value={figure.value} label={figure.label} />
        ))}
      </XStack>
    </Card>
  );
}
