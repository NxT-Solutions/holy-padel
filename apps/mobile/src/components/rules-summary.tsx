import type { NewMatchDefaults } from "@holy-padel/db";
import type { ReactNode } from "react";
import { XStack } from "tamagui";
import { Body, Card, Display, Pill } from "@/components/ui.tsx";
import { setupSummary, setupTitle } from "@/lib/format.ts";
import { colors, textAlpha } from "@/theme/colors.ts";

/**
 * The collapsed rules card: the current sport and format, one EDIT affordance,
 * and a wrap of small pills describing every rule. Keeps the setup screen short
 * while a tap opens the full editor.
 */
export function RulesSummaryCard({
  setup,
  onEdit,
}: {
  readonly setup: NewMatchDefaults;
  readonly onEdit: () => void;
}): ReactNode {
  return (
    <Card borderRadius={20} padding={16} gap={12} testID="rules-summary">
      <XStack alignItems="center" justifyContent="space-between">
        <Display fontSize={21}>{setupTitle(setup)}</Display>
        <XStack
          paddingVertical={6}
          paddingHorizontal={10}
          borderRadius={9}
          pressStyle={{ opacity: 0.6 }}
          role="button"
          aria-label="Edit match rules"
          onPress={onEdit}
        >
          <Body fontSize={11.5} fontWeight="800" letterSpacing={1.2} color={colors.accentOnCard}>
            EDIT
          </Body>
        </XStack>
      </XStack>
      <XStack flexWrap="wrap" gap={6}>
        {setupSummary(setup).map((label) => (
          <Pill
            key={label}
            backgroundColor={colors.row}
            borderWidth={1}
            borderColor={textAlpha(0.08)}
            paddingVertical={5}
            paddingHorizontal={10}
          >
            <Body fontSize={11.5} fontWeight="700" color={textAlpha(0.65)}>
              {label}
            </Body>
          </Pill>
        ))}
      </XStack>
    </Card>
  );
}
