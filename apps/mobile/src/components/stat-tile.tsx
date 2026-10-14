import type { ReactNode } from "react";
import { View } from "tamagui";
import { Body, Display } from "@/components/ui.tsx";
import { colors, textAlpha, whiteAlpha } from "@/theme/colors.ts";

/** A profile stat tile: ink, accent or white with the value in Anton. */
export function StatTile({
  value,
  label,
  variant,
}: {
  readonly value: string;
  readonly label: string;
  readonly variant: "ink" | "accent" | "white";
}): ReactNode {
  // The tile surfaces are theme tokens (dark tile, light tile), so the
  // hierarchy holds in both palettes: the ink tile stays the darkest surface,
  // the white tile the lightest. Accent is the accent in both modes.
  const palette = {
    ink: { background: colors.tileInk, value: colors.white, label: whiteAlpha(0.5) },
    accent: { background: colors.accent, value: colors.ink, label: colors.ink },
    white: { background: colors.tileWhite, value: colors.text, label: textAlpha(0.45) },
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
