import type { ReactNode } from "react";
import { styled, Text, View } from "tamagui";
import { colors, inkAlpha } from "@/theme/colors.ts";

/**
 * Anton display text — numerals, headings, team names.
 *
 * Do NOT set a tight `lineHeight` on this (anything near or below `fontSize`):
 * Anton's round glyphs (0, O, Q) overshoot below the baseline, so without the
 * font's natural descent room the bottom gets clipped — "0" reads as "U". Leave
 * `lineHeight` unset (natural metrics) unless it's clearly ≥ ~1.3× `fontSize`.
 */
export const Display = styled(Text, {
  fontFamily: "$heading",
  fontWeight: "400",
  letterSpacing: 0.5,
  color: colors.ink,
});

/** Archivo body text. */
export const Body = styled(Text, {
  fontFamily: "$body",
  color: colors.ink,
});

/** Tiny 800-weight uppercase label with wide tracking. */
export const Overline = styled(Text, {
  fontFamily: "$body",
  fontWeight: "800",
  fontSize: 10,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  color: inkAlpha(0.4),
});

/** White rounded card with the design's soft shadow. */
export const Card = styled(View, {
  backgroundColor: colors.white,
  borderRadius: 18,
  boxShadow: "0 2px 10px rgba(14, 17, 22, 0.05)",
});

/** Fully rounded container (chips, tab bar, status pills). */
export const Pill = styled(View, {
  borderRadius: 999,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
});

/** Round monogram avatar: ink disc, lime letter (blue for team B). */
export function Avatar({
  letter,
  size = 36,
  background = colors.ink,
  color = colors.lime,
}: {
  readonly letter: string;
  readonly size?: number;
  readonly background?: string;
  readonly color?: string;
}): ReactNode {
  return (
    <View
      width={size}
      height={size}
      borderRadius={size / 2}
      backgroundColor={background}
      alignItems="center"
      justifyContent="center"
    >
      <Display fontSize={size * 0.4} color={color}>
        {letter.toUpperCase()}
      </Display>
    </View>
  );
}

/** W/L chip from the form strips and match rows. */
export function ResultBadge({
  won,
  size = 24,
}: {
  readonly won: boolean;
  readonly size?: number;
}): ReactNode {
  return (
    <View
      width={size}
      height={size}
      borderRadius={size * 0.3}
      backgroundColor={won ? colors.lime : colors.greige}
      alignItems="center"
      justifyContent="center"
    >
      <Display fontSize={size * 0.46} color={won ? colors.ink : inkAlpha(0.55)} letterSpacing={0}>
        {won ? "W" : "L"}
      </Display>
    </View>
  );
}

/** The lime pulse dot marking live state and the serving pair. */
export function LiveDot({ size = 7 }: { readonly size?: number }): ReactNode {
  return <View width={size} height={size} borderRadius={size / 2} backgroundColor={colors.lime} />;
}
