import type { NewMatchDefaults } from "@holy-padel/db";
import {
  clearMatchDraft,
  loadMatchDefaults,
  pickDefaults,
  saveMatchDefaults,
} from "@holy-padel/db";
import type { TeamId } from "@holy-padel/scoring";
import type { ReactNode } from "react";
import { useState } from "react";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack } from "tamagui";
import { ModalHeader } from "@/components/modal-header.tsx";
import { SportOptions } from "@/components/new-match-parts.tsx";
import { SegmentedRow } from "@/components/segmented-row.tsx";
import { Body } from "@/components/ui.tsx";
import { useDbMutation, useDbQuery } from "@/db/provider.tsx";
import { goBack } from "@/lib/navigation.ts";
import { colors, textAlpha } from "@/theme/colors.ts";

/**
 * Your default match setup — prefills every new match. Every tap applies
 * instantly (like the theme setting); there is no SAVE step.
 */
export default function EditDefaultsScreen(): ReactNode {
  const insets = useSafeAreaInsets();
  const mutate = useDbMutation();
  const saved = useDbQuery(loadMatchDefaults);
  const [defaults, setDefaults] = useState<NewMatchDefaults>(
    () => saved ?? pickDefaults(undefined),
  );

  const update = (partial: Partial<NewMatchDefaults>): void => {
    const next = { ...defaults, ...partial };
    setDefaults(next);
    mutate((driver) => {
      saveMatchDefaults(driver, next);
      // A stale half-set-up draft must not shadow the fresh defaults.
      clearMatchDraft(driver);
    });
  };

  return (
    <YStack
      flex={1}
      backgroundColor={colors.screen}
      paddingTop={insets.top + 14}
      paddingBottom={insets.bottom + 16}
      gap={14}
    >
      <ModalHeader title="DEFAULTS" onClose={goBack} label="Done" />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 20 }}>
        <YStack backgroundColor={colors.card} borderRadius={20} padding={16} gap={13}>
          <SegmentedRow
            label="Format"
            options={[
              { value: "singles", label: "Singles" },
              { value: "doubles", label: "Doubles" },
            ]}
            value={defaults.format}
            onChange={(format) => {
              update({ format });
            }}
          />
          <SegmentedRow
            label="Sport"
            options={[
              { value: "padel", label: "Padel" },
              { value: "squash", label: "Squash" },
              { value: "pickleball", label: "Pickleball" },
            ]}
            value={defaults.sport}
            onChange={(sport) => {
              // Padel and pickleball don't offer best-of-5 — drop a stale
              // squash 5 rather than silently coercing at start time.
              update(
                sport !== "squash" && defaults.bestOf === 5 ? { sport, bestOf: 3 } : { sport },
              );
            }}
          />

          <SportOptions
            sport={defaults.sport}
            bestOf={defaults.bestOf}
            setBestOf={(bestOf) => {
              update({ bestOf });
            }}
            thirdSet={defaults.thirdSet}
            setThirdSet={(thirdSet) => {
              update({ thirdSet });
            }}
            deuceMode={defaults.deuceMode}
            setDeuceMode={(deuceMode) => {
              update({ deuceMode });
            }}
            squashMode={defaults.squashMode}
            setSquashMode={(squashMode) => {
              update({ squashMode });
            }}
            squashTarget={defaults.squashTarget}
            setSquashTarget={(squashTarget) => {
              update({ squashTarget });
            }}
            squashTiebreak={defaults.squashTiebreak}
            setSquashTiebreak={(squashTiebreak) => {
              update({ squashTiebreak });
            }}
            squashServeBoxes={defaults.squashServeBoxes}
            setSquashServeBoxes={(squashServeBoxes) => {
              update({ squashServeBoxes });
            }}
            pbTarget={defaults.pbTarget}
            setPbTarget={(pbTarget) => {
              update({ pbTarget });
            }}
            pbTiebreak={defaults.pbTiebreak}
            setPbTiebreak={(pbTiebreak) => {
              update({ pbTiebreak });
            }}
          />

          <SegmentedRow
            label="First serve"
            options={[
              { value: "undecided", label: "Undecided" },
              { value: "A", label: "Team A" },
              { value: "B", label: "Team B" },
            ]}
            value={defaults.firstServe}
            onChange={(firstServe) => {
              update({ firstServe: firstServe as TeamId | "undecided" });
            }}
          />
        </YStack>

        <Body fontSize={11.5} fontWeight="600" color={textAlpha(0.45)}>
          These options prefill every new match. Changes save instantly.
        </Body>
      </ScrollView>
    </YStack>
  );
}
