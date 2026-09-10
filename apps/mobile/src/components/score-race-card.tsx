import type { HeartRateSample } from "@holy-padel/db";
import type { ReactNode } from "react";
import { useState } from "react";
import { ScrollView } from "react-native";
import { XStack } from "tamagui";
import { SnakeChart } from "@/components/snake-chart.tsx";
import { Body, Card, Overline } from "@/components/ui.tsx";
import type { GameSeries } from "@/lib/game-series.ts";
import { colors, textAlpha } from "@/theme/colors.ts";

/**
 * The score-race card: pick a game, see who was ahead point by point, with
 * the watch-tracked heart rate overlaid when the match has one.
 */
export function ScoreRaceCard({
  series,
  heartRate,
  sport,
}: {
  readonly series: readonly GameSeries[];
  readonly heartRate?: readonly HeartRateSample[];
  readonly sport?: "padel" | "squash" | "pickleball" | undefined;
}): ReactNode {
  const [selected, setSelected] = useState<number | undefined>(undefined);
  if (series.length === 0) {
    return null;
  }
  const index = selected === undefined || selected >= series.length ? series.length - 1 : selected;
  const game = series[index];
  if (game === undefined) {
    return null;
  }
  const heartRateLabel =
    heartRate === undefined || heartRate.length === 0
      ? "Heart rate appears for matches tracked on your watch"
      : undefined;

  return (
    <Card borderRadius={20} paddingVertical={15} paddingHorizontal={17} gap={11}>
      <XStack alignItems="center" justifyContent="space-between">
        <Overline>SCORE RACE</Overline>
        <Body fontSize={10} fontWeight="800" letterSpacing={1.2} color={textAlpha(0.4)}>
          {sport === "squash"
            ? `GAME ${String(game.setNumber)} · ${String(game.pointsA)}–${String(game.pointsB)}`
            : `SET ${String(game.setNumber)} · GAME ${String(game.gameNumber)} · ${String(game.pointsA)}–${String(game.pointsB)}`}
        </Body>
      </XStack>

      {series.length > 1 && (
        <ScrollView horizontal={true} showsHorizontalScrollIndicator={false}>
          <XStack gap={7}>
            {series.map((entry, entryIndex) => {
              const active = entryIndex === index;
              return (
                <XStack
                  key={`${String(entry.setNumber)}-${String(entry.gameNumber)}`}
                  paddingVertical={6}
                  paddingHorizontal={11}
                  borderRadius={999}
                  backgroundColor={active ? colors.ink : "transparent"}
                  borderWidth={active ? 0 : 1}
                  borderColor={textAlpha(0.16)}
                  pressStyle={{ opacity: 0.8 }}
                  role="button"
                  onPress={() => {
                    setSelected(entryIndex);
                  }}
                >
                  <Body
                    fontSize={10.5}
                    fontWeight="800"
                    letterSpacing={0.8}
                    color={active ? colors.white : textAlpha(0.5)}
                  >
                    {`${String(entry.pointsA)}–${String(entry.pointsB)}`}
                  </Body>
                </XStack>
              );
            })}
          </XStack>
        </ScrollView>
      )}

      <SnakeChart
        steps={game.steps}
        startedAt={game.startedAt}
        endedAt={game.endedAt}
        {...(heartRate === undefined ? {} : { heartRate })}
      />

      {heartRateLabel !== undefined && (
        <Body fontSize={10.5} fontWeight="600" color={textAlpha(0.4)}>
          {heartRateLabel}
        </Body>
      )}
    </Card>
  );
}
