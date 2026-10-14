import type { ReactNode } from "react";
import { XStack, YStack } from "tamagui";
import { CardHeader, Figure, ShareRow } from "@/components/insight-parts.tsx";
import { Body, Card, Display } from "@/components/ui.tsx";
import type { Clutch, Tally } from "@/lib/clutch.ts";
import { percentOf } from "@/lib/clutch.ts";
import { colors, textAlpha } from "@/theme/colors.ts";

/** How far pressure points have to differ from all points before it's worth saying. */
const VERDICT_GAP = 3;

function verdict(pressure: number, overall: number): string {
  if (pressure - overall >= VERDICT_GAP) {
    return "You raise your game when it matters";
  }
  if (overall - pressure >= VERDICT_GAP) {
    return "The big points are getting away from you";
  }
  return "Steady — big points go like any other";
}

function detail(tally: Tally): string {
  return `${String(tally.won)} of ${String(tally.of)}`;
}

/**
 * The "under pressure" card: the share of game, set and match points won,
 * held against all points, then the padel-specific detail (break points,
 * golden points, tie-breaks) and the sets turned around. Rows with nothing
 * played are left out.
 */
export function ClutchCard({
  clutch,
  comebacks,
  slips,
}: {
  readonly clutch: Clutch;
  readonly comebacks: number;
  readonly slips: number;
}): ReactNode {
  const pressure = percentOf(clutch.pressure);
  const overall = percentOf(clutch.points);
  if (pressure === undefined || overall === undefined) {
    return null;
  }
  const rows = [
    { label: "Break points won", tally: clutch.breakPoints, id: "break-won" },
    { label: "Break points saved", tally: clutch.serveSaves, id: "break-saved" },
    { label: "Golden points", tally: clutch.deciding, id: "deciding" },
    { label: "Tie-breaks", tally: clutch.tieBreaks, id: "tie-breaks" },
  ].filter((row) => row.tally.of > 0);
  return (
    <Card
      borderRadius={20}
      paddingVertical={15}
      paddingHorizontal={17}
      gap={14}
      testID="clutch-card"
    >
      <CardHeader title="UNDER PRESSURE" aside={`${String(clutch.pressure.of)} BIG POINTS`} />
      <XStack alignItems="center" gap={14}>
        <Display fontSize={46} color={colors.accentOnCard} testID="pressure-share">
          {`${String(pressure)}%`}
        </Display>
        <YStack flex={1} gap={3}>
          <Body fontSize={14} fontWeight="800">
            {verdict(pressure, overall)}
          </Body>
          <Body fontSize={11.5} fontWeight="600" color={textAlpha(0.5)}>
            {`of game, set and match points won — ${String(overall)}% of all points`}
          </Body>
        </YStack>
      </XStack>
      {rows.length === 0 ? null : (
        <YStack gap={12}>
          {rows.map((row) => (
            <ShareRow
              key={row.id}
              label={row.label}
              detail={detail(row.tally)}
              won={row.tally.won}
              of={row.tally.of}
              testID={`clutch-${row.id}`}
            />
          ))}
        </YStack>
      )}
      {comebacks + slips === 0 ? null : (
        <XStack backgroundColor={colors.row} borderRadius={14} paddingVertical={10}>
          <Figure value={String(comebacks)} label="WON FROM BEHIND" />
          <Figure value={String(slips)} label="LEADS LOST" color={textAlpha(0.55)} />
        </XStack>
      )}
    </Card>
  );
}
