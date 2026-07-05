import {
  ArrowRight as LucideArrowRight,
  Check as LucideCheck,
  ChevronLeft as LucideChevronLeft,
  ChevronRight as LucideChevronRight,
  Heart as LucideHeart,
  Pause as LucidePause,
  Play as LucidePlay,
  Plus as LucidePlus,
  Search as LucideSearch,
  Undo2 as LucideUndo2,
} from "lucide-react-native";
import type { ReactNode } from "react";
import { colors } from "@/theme/colors.ts";

/**
 * The app's icons, backed by lucide-react-native. Thin wrappers keep the same
 * `{ size, color, strokeWidth }` API and the design's slightly bolder default
 * stroke weights, so call sites and the look are unchanged — only the SVG
 * paths are no longer hand-maintained.
 */
interface IconProps {
  readonly size?: number;
  readonly color?: string;
  readonly strokeWidth?: number;
}

export function ArrowRight({
  size = 15,
  color = colors.ink,
  strokeWidth = 2.8,
}: IconProps): ReactNode {
  return <LucideArrowRight size={size} color={color} strokeWidth={strokeWidth} />;
}

export function Plus({ size = 15, color = colors.ink, strokeWidth = 3 }: IconProps): ReactNode {
  return <LucidePlus size={size} color={color} strokeWidth={strokeWidth} />;
}

/** The curved undo arrow from the live screens (Lucide's undo-2). */
export function Undo({ size = 15, color = colors.ink, strokeWidth = 2.6 }: IconProps): ReactNode {
  return <LucideUndo2 size={size} color={color} strokeWidth={strokeWidth} />;
}

export function ChevronLeft({
  size = 15,
  color = colors.ink,
  strokeWidth = 2.8,
}: IconProps): ReactNode {
  return <LucideChevronLeft size={size} color={color} strokeWidth={strokeWidth} />;
}

export function ChevronRight({
  size = 15,
  color = colors.ink,
  strokeWidth = 2.6,
}: IconProps): ReactNode {
  return <LucideChevronRight size={size} color={color} strokeWidth={strokeWidth} />;
}

export function Check({ size = 15, color = colors.ink, strokeWidth = 3.4 }: IconProps): ReactNode {
  return <LucideCheck size={size} color={color} strokeWidth={strokeWidth} />;
}

export function Search({ size = 15, color = colors.ink, strokeWidth = 2.5 }: IconProps): ReactNode {
  return <LucideSearch size={size} color={color} strokeWidth={strokeWidth} />;
}

export function Pause({ size = 15, color = colors.ink, strokeWidth = 2.6 }: IconProps): ReactNode {
  return <LucidePause size={size} color={color} strokeWidth={strokeWidth} />;
}

export function Play({ size = 15, color = colors.ink, strokeWidth = 2.6 }: IconProps): ReactNode {
  return <LucidePlay size={size} color={color} strokeWidth={strokeWidth} />;
}

export function Heart({ size = 15, color = colors.ink, strokeWidth = 2.6 }: IconProps): ReactNode {
  return <LucideHeart size={size} color={color} strokeWidth={strokeWidth} />;
}
