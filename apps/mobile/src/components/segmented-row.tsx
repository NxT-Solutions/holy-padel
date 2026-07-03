import type { ReactNode } from "react";
import { Pressable } from "react-native";
import { View, XStack } from "tamagui";
import { Body } from "@/components/ui.tsx";
import { colors, inkAlpha } from "@/theme/colors.ts";

export interface Segment<T extends string | number> {
  readonly value: T;
  readonly label: string;
}

/** A settings row with the design's pill segmented control on the right. */
export function SegmentedRow<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  readonly label: string;
  readonly options: readonly Segment<T>[];
  readonly value: T;
  readonly onChange: (next: T) => void;
}): ReactNode {
  return (
    <XStack alignItems="center" justifyContent="space-between">
      <Body fontSize={13} fontWeight="700">
        {label}
      </Body>
      <XStack backgroundColor={colors.toggle} borderRadius={11} padding={3} gap={2}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              role="button"
              onPress={() => {
                onChange(option.value);
              }}
            >
              <View
                paddingVertical={7}
                paddingHorizontal={13}
                borderRadius={9}
                backgroundColor={active ? colors.ink : "transparent"}
              >
                <Body
                  fontSize={12.5}
                  fontWeight={active ? "800" : "700"}
                  color={active ? colors.white : inkAlpha(0.45)}
                >
                  {option.label}
                </Body>
              </View>
            </Pressable>
          );
        })}
      </XStack>
    </XStack>
  );
}
