import type { ReactNode } from "react";
import { useId } from "react";
import Svg, { Defs, Line, RadialGradient, Rect, Stop } from "react-native-svg";
import { View } from "tamagui";
import { sportColor } from "@/theme/colors.ts";

/**
 * Decorative court art for the "Floodlit" look: a soft floodlight glow, the
 * faint court markings of the sport being played, and the small sport stripe
 * that tags a match row. The glow and lines are absolutely positioned, fill
 * their parent and never intercept a tap — drop them as the FIRST child of an
 * `position="relative"` + `overflow="hidden"` parent so content renders above
 * them. Tamagui views default to `static` on web, so without the explicit
 * `relative` the art anchors to the screen instead of the card.
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

/** The simple markings of each court, inset ~6% from the edges. */
export function CourtLines({
  sport,
  color,
  opacity,
}: {
  readonly sport: "padel" | "squash" | "pickleball" | undefined;
  readonly color: string;
  readonly opacity: number;
}): ReactNode {
  return (
    <View position="absolute" top={0} left={0} right={0} bottom={0} pointerEvents="none">
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        opacity={opacity}
      >
        <CourtMarkings sport={sport} color={color} />
      </Svg>
    </View>
  );
}

/** Picks the set of court lines for a sport (kept flat — no nested ternary). */
function CourtMarkings({
  sport,
  color,
}: {
  readonly sport: "padel" | "squash" | "pickleball" | undefined;
  readonly color: string;
}): ReactNode {
  if (sport === "squash") {
    return <SquashT color={color} />;
  }
  if (sport === "pickleball") {
    return <PickleballCourt color={color} />;
  }
  return <PadelCourt color={color} />;
}

/** The 4px sport marker stripe at the left of a match row. */
export function SportStripe({
  sport,
}: {
  readonly sport: "padel" | "squash" | "pickleball" | undefined;
}): ReactNode {
  return <View width={4} height={28} borderRadius={999} backgroundColor={sportColor(sport)} />;
}

/** Padel: outer box, centre net, a centre service line each side, service lines. */
function PadelCourt({ color }: { readonly color: string }): ReactNode {
  return (
    <>
      <Rect
        x="6"
        y="6"
        width="88"
        height="88"
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <Line
        x1="6"
        y1="50"
        x2="94"
        y2="50"
        stroke={color}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <Line
        x1="50"
        y1="6"
        x2="50"
        y2="50"
        stroke={color}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <Line
        x1="50"
        y1="50"
        x2="50"
        y2="94"
        stroke={color}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <Line
        x1="6"
        y1="30"
        x2="94"
        y2="30"
        stroke={color}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <Line
        x1="6"
        y1="70"
        x2="94"
        y2="70"
        stroke={color}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </>
  );
}

/** Squash: the T — a short line across, a half-court line, two service boxes. */
function SquashT({ color }: { readonly color: string }): ReactNode {
  return (
    <>
      <Line
        x1="6"
        y1="55"
        x2="94"
        y2="55"
        stroke={color}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <Line
        x1="50"
        y1="55"
        x2="50"
        y2="94"
        stroke={color}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <Rect
        x="6"
        y="70"
        width="44"
        height="24"
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <Rect
        x="50"
        y="70"
        width="44"
        height="24"
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </>
  );
}

/** Pickleball: outer box, net, two kitchen lines, centre lines to the baseline. */
function PickleballCourt({ color }: { readonly color: string }): ReactNode {
  return (
    <>
      <Rect
        x="6"
        y="6"
        width="88"
        height="88"
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <Line
        x1="6"
        y1="50"
        x2="94"
        y2="50"
        stroke={color}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <Line
        x1="6"
        y1="30"
        x2="94"
        y2="30"
        stroke={color}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <Line
        x1="6"
        y1="70"
        x2="94"
        y2="70"
        stroke={color}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <Line
        x1="50"
        y1="6"
        x2="50"
        y2="30"
        stroke={color}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <Line
        x1="50"
        y1="70"
        x2="50"
        y2="94"
        stroke={color}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </>
  );
}
