import type { ReactNode } from "react";
import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "@/theme/colors.ts";

interface IconProps {
  readonly size?: number;
  readonly color?: string;
  readonly strokeWidth?: number;
}

function strokeProps({ size = 15, color = colors.ink, strokeWidth = 2.8 }: IconProps): {
  size: number;
  color: string;
  strokeWidth: number;
} {
  return { size, color, strokeWidth };
}

/** → from the design's primary buttons. */
export function ArrowRight(props: IconProps): ReactNode {
  const { size, color, strokeWidth } = strokeProps(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12h14"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="m13 6 6 6-6 6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function Plus(props: IconProps): ReactNode {
  const { size, color, strokeWidth } = strokeProps({ strokeWidth: 3, ...props });
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

/** The undo arrow from the live screens. */
export function Undo(props: IconProps): ReactNode {
  const { size, color, strokeWidth } = strokeProps({ strokeWidth: 2.6, ...props });
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 8h10a6 6 0 1 1-6 10"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7 4 3 8l4 4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ChevronLeft(props: IconProps): ReactNode {
  const { size, color, strokeWidth } = strokeProps(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="m15 6-6 6 6 6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ChevronRight(props: IconProps): ReactNode {
  const { size, color, strokeWidth } = strokeProps({ strokeWidth: 2.6, ...props });
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="m9 6 6 6-6 6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** ✓ in the player picker's selected rows. */
export function Check(props: IconProps): ReactNode {
  const { size, color, strokeWidth } = strokeProps({ strokeWidth: 3.4, ...props });
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="m5 12 5 5 9-10"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function Search(props: IconProps): ReactNode {
  const { size, color, strokeWidth } = strokeProps({ strokeWidth: 2.5, ...props });
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={strokeWidth} />
      <Path d="m20 20-3.5-3.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}
