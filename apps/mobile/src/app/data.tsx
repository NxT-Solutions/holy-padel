import { countMatches, databaseSizeBytes, deleteMatch, listMatches } from "@holy-padel/db";
import type { ReactNode } from "react";
import { Share } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack } from "tamagui";
import { ModalHeader } from "@/components/modal-header.tsx";
import { Body, Card, Display, Overline } from "@/components/ui.tsx";
import { useDbMutation, useDbQuery } from "@/db/provider.tsx";
import { confirmDestructive } from "@/lib/confirm.ts";
import { fullDayLabel, megabytesLabel, pairLabel } from "@/lib/format.ts";
import { goBack } from "@/lib/navigation.ts";
import { colors, inkAlpha, whiteAlpha } from "@/theme/colors.ts";

/** Local data controls — everything lives in on-device SQLite, so this is where
 *  you export it or wipe it. Reached from the "ON THIS PHONE" card on Profile. */
export default function DataScreen(): ReactNode {
  const insets = useSafeAreaInsets();
  const mutate = useDbMutation();
  const matches = useDbQuery(listMatches);
  const count = useDbQuery(countMatches);
  const sizeBytes = useDbQuery(databaseSizeBytes);

  const exportAll = (): void => {
    const lines = matches.map((match) => {
      const vs = `${pairLabel(match.names.A)} vs ${pairLabel(match.names.B)}`;
      return `${fullDayLabel(match.startedAt)} — ${vs} · ${match.scoreLine ?? "in progress"}`;
    });
    void Share.share({ message: `Holy Padel — ${String(count)} matches\n\n${lines.join("\n")}` });
  };

  const deleteAll = (): void => {
    confirmDestructive({
      title: "Delete all matches?",
      message: "Removes every match and its points from this phone. This can't be undone.",
      confirmLabel: "Delete all",
      onConfirm: () => {
        mutate((driver) => {
          for (const match of listMatches(driver)) {
            deleteMatch(driver, match.id);
          }
        });
        goBack();
      },
    });
  };

  return (
    <YStack
      flex={1}
      backgroundColor={colors.cream}
      paddingTop={insets.top + 14}
      paddingBottom={insets.bottom + 16}
      paddingHorizontal={20}
      gap={18}
    >
      <ModalHeader title="YOUR DATA" onClose={goBack} label="Close" />

      <YStack
        backgroundColor={colors.ink}
        borderRadius={20}
        paddingVertical={18}
        paddingHorizontal={18}
        gap={4}
      >
        <Overline color={colors.lime}>ON THIS PHONE</Overline>
        <Display fontSize={30} color={colors.white}>
          {`${String(count)} matches`}
        </Display>
        <Body fontSize={12} fontWeight="600" color={whiteAlpha(0.5)}>
          {`SQLite · ${megabytesLabel(sizeBytes)} · never leaves your device`}
        </Body>
      </YStack>

      <YStack gap={10}>
        <Card
          borderRadius={16}
          paddingVertical={16}
          paddingHorizontal={18}
          pressStyle={{ opacity: 0.85 }}
          role="button"
          aria-label="Export matches"
          onPress={exportAll}
          testID="export-data"
        >
          <Body fontSize={15} fontWeight="800" color={colors.ink}>
            Export matches
          </Body>
          <Body fontSize={12} fontWeight="600" color={inkAlpha(0.45)} marginTop={2}>
            Share every match as text
          </Body>
        </Card>

        <Card
          borderRadius={16}
          paddingVertical={16}
          paddingHorizontal={18}
          pressStyle={{ opacity: 0.85 }}
          role="button"
          aria-label="Delete all matches"
          onPress={deleteAll}
          testID="delete-all-data"
        >
          <Body fontSize={15} fontWeight="800" color={colors.danger}>
            Delete all matches
          </Body>
          <Body fontSize={12} fontWeight="600" color={inkAlpha(0.45)} marginTop={2}>
            Wipe every match from this phone
          </Body>
        </Card>
      </YStack>
    </YStack>
  );
}
