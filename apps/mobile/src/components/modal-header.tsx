import type { ReactNode } from "react";
import { XStack } from "tamagui";
import { ChevronLeft, X } from "@/components/icons.tsx";
import { Display } from "@/components/ui.tsx";
import { colors, inkAlpha } from "@/theme/colors.ts";

/**
 * A round, comfortably-sized tap target for a header glyph. The circular chip
 * (rather than bare text jammed into the corner) gives the control room to
 * breathe away from the screen edge and a clear 40pt hit area.
 */
function IconButton({
  onPress,
  label,
  children,
}: {
  readonly onPress: () => void;
  readonly label: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <XStack
      width={40}
      height={40}
      borderRadius={20}
      alignItems="center"
      justifyContent="center"
      backgroundColor={inkAlpha(0.06)}
      pressStyle={{ opacity: 0.6, backgroundColor: inkAlpha(0.12) }}
      role="button"
      aria-label={label}
      onPress={onPress}
    >
      {children}
    </XStack>
  );
}

/**
 * The shared slide-out header: a back/close icon button on the left, then the
 * title. Every modal uses this so the way out is always an icon in the same
 * spot, inset from the edge — never text crammed against the corner.
 *
 * `variant` picks the glyph: "close" (✕, dismiss to where you came from) or
 * "back" (‹, step back a level). `label` is the accessible name — keep it stable
 * ("Cancel", "Close") so it reads well to VoiceOver and anchors E2E selectors.
 */
export function ModalHeader({
  title,
  onClose,
  variant = "close",
  label = variant === "back" ? "Back" : "Close",
  right,
  titleSize = 26,
}: {
  readonly title: string;
  readonly onClose: () => void;
  readonly variant?: "close" | "back";
  readonly label?: string;
  readonly right?: ReactNode;
  readonly titleSize?: number;
}): ReactNode {
  return (
    <XStack alignItems="center" gap={12}>
      <IconButton onPress={onClose} label={label}>
        {variant === "back" ? (
          <ChevronLeft size={22} color={colors.ink} />
        ) : (
          <X size={20} color={colors.ink} />
        )}
      </IconButton>
      <Display fontSize={titleSize} flex={1}>
        {title}
      </Display>
      {right}
    </XStack>
  );
}
