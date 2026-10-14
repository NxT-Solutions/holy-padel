import type { ReactNode } from "react";
import { Pressable } from "react-native";
import { View, XStack, YStack } from "tamagui";
import { Body } from "@/components/ui.tsx";
import { useDbQuery } from "@/db/provider.tsx";
import { ACCENT_CHOICES, colors, TEAM_B_CHOICES, textAlpha } from "@/theme/colors.ts";
import { loadColorSetting, useSetColorSetting } from "@/theme/theme.tsx";

/** One round swatch; the picked one gets a ring in the text colour. */
function Swatch({
  color,
  label,
  selected,
  onPress,
  testID,
}: {
  readonly color: string;
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly testID: string;
}): ReactNode {
  // A plain Pressable around non-pressable content: an inner pressStyle would
  // become a second responder and swallow the tap on native.
  return (
    <Pressable
      onPress={onPress}
      role="button"
      aria-label={label}
      aria-selected={selected}
      testID={testID}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <View
        width={34}
        height={34}
        borderRadius={17}
        borderWidth={2.5}
        borderColor={selected ? colors.text : "transparent"}
        alignItems="center"
        justifyContent="center"
      >
        <View width={24} height={24} borderRadius={12} backgroundColor={color} />
      </View>
    </Pressable>
  );
}

function SwatchRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <YStack gap={8}>
      <Body fontSize={13} fontWeight="700">
        {label}
      </Body>
      <XStack gap={6} flexWrap="wrap">
        {children}
      </XStack>
    </YStack>
  );
}

/**
 * Settings: pick the highlight colour (buttons, live/serve, wins, Team A) and
 * the Team B colour. Applies instantly, like the theme. The phone only — the
 * watches keep their own palette.
 */
export function ColorSettings(): ReactNode {
  const setting = useDbQuery(loadColorSetting);
  const setColor = useSetColorSetting();
  const accent = setting.accent ?? "orange";
  const teamB = setting.teamB ?? "violet";
  return (
    <YStack gap={14}>
      <SwatchRow label="Highlight colour">
        {ACCENT_CHOICES.map((choice) => (
          <Swatch
            key={choice.id}
            color={choice.accent}
            label={`${choice.label} highlight`}
            selected={choice.id === accent}
            onPress={() => {
              setColor("accent", choice.id);
            }}
            testID={`accent-${choice.id}`}
          />
        ))}
      </SwatchRow>
      <SwatchRow label="Team B colour">
        {TEAM_B_CHOICES.map((choice) => (
          <Swatch
            key={choice.id}
            color={choice.color}
            label={`${choice.label} Team B`}
            selected={choice.id === teamB}
            onPress={() => {
              setColor("teamB", choice.id);
            }}
            testID={`teamb-${choice.id}`}
          />
        ))}
      </SwatchRow>
      <Body fontSize={11} fontWeight="600" color={textAlpha(0.45)}>
        Highlight marks buttons, the serve and your wins; Team B colours the other side.
      </Body>
    </YStack>
  );
}
