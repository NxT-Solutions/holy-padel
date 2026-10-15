import type { ReactNode } from "react";
import { useId } from "react";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { View } from "tamagui";
import { sportColor } from "@/theme/colors.ts";

/**
 * Decorative art for the "Floodlit" look: a soft floodlight glow and the small
 * sport stripe that tags a match row. The glow is absolutely positioned, fills
 * its parent and never intercepts a tap — drop it as the FIRST child of a
 * `position="relative"` + `overflow="hidden"` parent so content renders above
 * it. Tamagui views default to `static` on web, so without the explicit
 * `relative` the glow anchors to the screen instead of the card.
 * Colours come in via props from `colors` / `sportColor`; no hex here.
 */

/** A soft radial floodlight washing down from the top of its parent. */
export function FloodlightGlow({
  color,
  opacity,
}: {
  readonly color: string;
  readonly opacity: number;
}): ReactNode {
  // useId keeps the gradient id unique per instance; strip the separators React
  // emits so the value is safe inside a CSS url(#…) reference.
  const gradientId = `floodlight-${useId().replaceAll(/[^a-zA-Z0-9]/gu, "")}`;
  return (
    <View position="absolute" top={0} left={0} right={0} bottom={0} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="0%" rx="75%" ry="75%">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
    </View>
  );
}

/** The 4px sport marker stripe at the left of a match row. */
export function SportStripe({
  sport,
}: {
  readonly sport: "padel" | "squash" | "pickleball" | undefined;
}): ReactNode {
  return <View width={4} height={28} borderRadius={999} backgroundColor={sportColor(sport)} />;
}
