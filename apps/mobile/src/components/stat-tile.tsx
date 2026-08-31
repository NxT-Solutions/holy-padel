import type { ReactNode } from "react";
import { View } from "tamagui";
import { Body, Display } from "@/components/ui.tsx";
import { colors, whiteAlpha } from "@/theme/colors.ts";

/** A profile stat tile: ink, lime or white with the value in Anton. */
export function StatTile({
  value,
  label,
  variant,
}: {
  readonly value: string;
  readonly label: string;
  readonly variant: "ink" | "lime" | "white";
}): ReactNode {
  // The lime and white tiles keep constant backgrounds, so their text stays
  // ink in both themes — only the ink tile's label follows the theme.
  const palette = {
    ink: { background: colors.ink, value: colors.white, label: whiteAlpha(0.5) },
    lime: { background: colors.lime, value: colors.ink, label: colors.ink },
    white: { background: colors.white, value: colors.ink, label: colors.ink },
  }[variant];
  const { background, value: valueColor, label: labelColor } = palette;
  return (
    <View
      flex={1}
      backgroundColor={background}
      borderRadius={16}
      paddingTop={13}
      paddingBottom={11}
      alignItems="center"
      boxShadow={variant === "white" ? "0 2px 10px rgba(14, 17, 22, 0.05)" : "unset"}
    >
      <Display fontSize={24} color={valueColor}>
        {value}
      </Display>
      <Body fontSize={9} fontWeight="800" letterSpacing={1.5} color={labelColor} marginTop={2}>
        {label}
      </Body>
    </View>
  );
}
