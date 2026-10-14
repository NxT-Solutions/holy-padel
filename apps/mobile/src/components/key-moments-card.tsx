import type { MatchSummary } from "@holy-padel/db";
import { getOwner } from "@holy-padel/db";
import type { PointEvent } from "@holy-padel/scoring";
import type { ReactNode } from "react";
import { View, XStack, YStack } from "tamagui";
import { CardHeader } from "@/components/insight-parts.tsx";
import { Body, Card } from "@/components/ui.tsx";
import { useDbQuery } from "@/db/provider.tsx";
import type { Clutch, Turnaround } from "@/lib/clutch.ts";
import { matchClutch, matchTurnarounds, percentOf } from "@/lib/clutch.ts";
import { ownerTeamOf } from "@/lib/format.ts";
import { colors, textAlpha } from "@/theme/colors.ts";

interface Moment {
  readonly key: string;
  readonly text: string;
  readonly good: boolean;
}

function turnaroundText(turnaround: Turnaround, unit: string): string {
  const own = String(turnaround.at.own);
  const other = String(turnaround.at.other);
  const where = `${unit} ${String(turnaround.setNumber)}`;
  return turnaround.cameBack
    ? `Came back from ${own}–${other} down to win ${where}`
    : `Let a ${own}–${other} lead slip in ${where}`;
}

function times(count: number): string {
  return count === 1 ? "once" : `${String(count)} times`;
}

/** The clutch lines worth reading for one match — only what actually came up. */
function clutchMoments(clutch: Clutch, decidingName: string): Moment[] {
  const moments: Moment[] = [];
  const { breakPoints, serveSaves, deciding, pressure, points } = clutch;
  if (breakPoints.of > 0) {
    moments.push({
      key: "break",
      text: `Broke serve ${times(breakPoints.won)} from ${String(breakPoints.of)} chances`,
      good: breakPoints.won * 2 >= breakPoints.of,
    });
  }
  if (serveSaves.of > 0) {
    moments.push({
      key: "saves",
      text: `Saved ${String(serveSaves.won)} of ${String(serveSaves.of)} break points`,
      good: serveSaves.won * 2 >= serveSaves.of,
    });
  }
  if (deciding.of > 0) {
    moments.push({
      key: "deciding",
      text: `Won ${String(deciding.won)} of ${String(deciding.of)} ${decidingName}`,
      good: deciding.won * 2 >= deciding.of,
    });
  }
  const pressureShare = percentOf(pressure);
  const overall = percentOf(points);
  if (pressureShare !== undefined && overall !== undefined) {
    moments.push({
      key: "pressure",
      text: `Won ${String(pressureShare)}% of big points (${String(overall)}% of all points)`,
      good: pressureShare >= overall,
    });
  }
  return moments;
}

/**
 * The few things that decided this match, from your side: sets turned around,
 * break points, golden points and how the big points went. Hidden when there
 * is nothing to say.
 */
export function KeyMomentsCard({
  match,
  events,
}: {
  readonly match: MatchSummary;
  readonly events: readonly PointEvent[];
}): ReactNode {
  const owner = useDbQuery(getOwner);
  const team = ownerTeamOf(match, owner?.id ?? "nico");
  const sport = match.config.sport ?? "padel";
  const unit = sport === "padel" ? "set" : "game";
  const decidingName = match.config.deuceMode === "starPoint" ? "star points" : "golden points";
  const moments: Moment[] = [
    ...matchTurnarounds(match.config, events, team).map((turnaround) => ({
      key: `turn-${String(turnaround.setNumber)}`,
      text: turnaroundText(turnaround, unit),
      good: turnaround.cameBack,
    })),
    ...clutchMoments(matchClutch(match.config, events, team), decidingName),
  ];
  if (moments.length === 0) {
    return null;
  }
  return (
    <Card
      borderRadius={20}
      paddingVertical={15}
      paddingHorizontal={17}
      gap={12}
      testID="key-moments"
    >
      <CardHeader title="KEY MOMENTS" />
      <YStack gap={10}>
        {moments.map((moment) => (
          <XStack key={moment.key} alignItems="center" gap={10}>
            <View
              width={7}
              height={7}
              borderRadius={999}
              backgroundColor={moment.good ? colors.accent : textAlpha(0.25)}
            />
            <Body flex={1} fontSize={13.5} fontWeight="700">
              {moment.text}
            </Body>
          </XStack>
        ))}
      </YStack>
    </Card>
  );
}
