import type { ReactNode } from "react";
import { View, XStack, YStack } from "tamagui";
import { Body, Display, Overline } from "@/components/ui.tsx";
import type { Tally } from "@/lib/clutch.ts";
import { percentOf } from "@/lib/clutch.ts";
import { ZONES } from "@/lib/effort.ts";
import { accentAlpha, colors, textAlpha } from "@/theme/colors.ts";

/** A card's overline title with an optional quiet figure on the right. */
export function CardHeader({
  title,
  aside,
}: {
  readonly title: string;
  readonly aside?: string;
}): ReactNode {
  return (
    <XStack alignItems="center" justifyContent="space-between">
      <Overline>{title}</Overline>
      {aside === undefined ? null : (
        <Body fontSize={10} fontWeight="800" letterSpacing={1.2} color={textAlpha(0.4)}>
          {aside}
        </Body>
      )}
    </XStack>
  );
}

/** One line of an insight card: what it is, how much of it went your way, and the count. */
export function ShareRow({
  label,
  detail,
  won,
  of,
  testID,
}: {
  readonly label: string;
  readonly detail: string;
  readonly won: number;
  readonly of: number;
  readonly testID?: string;
}): ReactNode {
  const share = of === 0 ? 0 : won / of;
  return (
    <YStack gap={6} {...(testID === undefined ? {} : { testID })}>
      <XStack alignItems="baseline" justifyContent="space-between">
        <Body fontSize={13.5} fontWeight="700">
          {label}
        </Body>
        <XStack alignItems="baseline" gap={7}>
          <Body fontSize={10.5} fontWeight="700" color={textAlpha(0.4)}>
            {detail}
          </Body>
          <Display fontSize={16}>{`${String(Math.round(share * 100))}%`}</Display>
        </XStack>
      </XStack>
      <View height={6} borderRadius={999} backgroundColor={colors.greige} overflow="hidden">
        <View width={`${String(share * 100)}%`} height="100%" backgroundColor={colors.accent} />
      </View>
    </YStack>
  );
}

/** One of the two headline shares: a big percentage, what it is, and the raw count. */
export function ShareTile({
  tally,
  label,
  explain,
  testID,
}: {
  readonly tally: Tally;
  readonly label: string;
  readonly explain: string;
  readonly testID: string;
}): ReactNode {
  const share = percentOf(tally);
  return (
    <YStack
      flex={1}
      backgroundColor={colors.row}
      borderRadius={14}
      paddingVertical={12}
      paddingHorizontal={12}
      gap={2}
      testID={testID}
    >
      <Display fontSize={34} color={share === undefined ? textAlpha(0.3) : colors.accentOnCard}>
        {share === undefined ? "—" : `${String(share)}%`}
      </Display>
      <Body fontSize={10} fontWeight="800" letterSpacing={1.2}>
        {label}
      </Body>
      <Body fontSize={11} fontWeight="600" color={textAlpha(0.5)}>
        {explain}
      </Body>
      <Body fontSize={11} fontWeight="700" color={textAlpha(0.4)}>
        {tally.of === 0 ? "none yet" : `${String(tally.won)} of ${String(tally.of)}`}
      </Body>
    </YStack>
  );
}

/** A big figure over a small uppercase label. */
export function Figure({
  value,
  label,
  color,
}: {
  readonly value: string;
  readonly label: string;
  readonly color?: string;
}): ReactNode {
  return (
    <YStack flex={1} alignItems="center" gap={2}>
      <Display fontSize={22} {...(color === undefined ? {} : { color })}>
        {value}
      </Display>
      <Body fontSize={8.5} fontWeight="800" letterSpacing={1.2} color={textAlpha(0.4)}>
        {label}
      </Body>
    </YStack>
  );
}

const ZONE_ALPHA = [0.2, 0.36, 0.55, 0.78, 1] as const;

/** Zones read as one ramp of the highlight colour — calm is faint, flat out is solid. */
export function zoneColor(index: number): string {
  return accentAlpha(ZONE_ALPHA[index] ?? 1);
}

/** Time in each heart-rate zone as one stacked bar. */
export function ZoneBar({
  zones,
  height = 12,
}: {
  readonly zones: readonly number[];
  readonly height?: number;
}): ReactNode {
  const total = zones.reduce((sum, ms) => sum + ms, 0);
  if (total === 0) {
    return null;
  }
  return (
    <XStack height={height} borderRadius={999} overflow="hidden" gap={2}>
      {zones.map((ms, index) =>
        ms === 0 ? null : (
          <View key={ZONES[index]?.label ?? index} flex={ms} backgroundColor={zoneColor(index)} />
        ),
      )}
    </XStack>
  );
}

/** "38 min", or "1 h 12" past the hour. */
export function minutesLabel(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) {
    return `${String(minutes)} min`;
  }
  const rest = minutes % 60;
  return `${String(Math.floor(minutes / 60))} h ${rest < 10 ? "0" : ""}${String(rest)}`;
}

/** A zone's bpm range for a max heart rate: "under 114", "114–132", "171+". */
export function zoneRange(index: number, maxHr: number): string {
  const from = Math.round((ZONES[index]?.from ?? 0) * maxHr);
  const next = ZONES[index + 1];
  if (index === 0 && next !== undefined) {
    return `under ${String(Math.round(next.from * maxHr))}`;
  }
  return next === undefined
    ? `${String(from)}+`
    : `${String(from)}–${String(Math.round(next.from * maxHr) - 1)}`;
}

/** The zones under a stacked bar: swatch, name and bpm range, time and share. */
export function ZoneLegend({
  zones,
  maxHr,
}: {
  readonly zones: readonly number[];
  readonly maxHr: number;
}): ReactNode {
  const total = zones.reduce((sum, ms) => sum + ms, 0);
  return (
    <YStack gap={7}>
      {ZONES.map((zone, index) => {
        const ms = zones[index] ?? 0;
        return (
          <XStack key={zone.label} alignItems="center" gap={9}>
            <View width={10} height={10} borderRadius={3} backgroundColor={zoneColor(index)} />
            <Body flex={1} fontSize={12.5} fontWeight="700">
              {`${zone.label} · ${zoneRange(index, maxHr)} bpm`}
            </Body>
            <Body fontSize={11.5} fontWeight="700" color={textAlpha(0.45)}>
              {minutesLabel(ms)}
            </Body>
            <Display fontSize={14} width={40} textAlign="right">
              {`${String(total === 0 ? 0 : Math.round((ms / total) * 100))}%`}
            </Display>
          </XStack>
        );
      })}
    </YStack>
  );
}
