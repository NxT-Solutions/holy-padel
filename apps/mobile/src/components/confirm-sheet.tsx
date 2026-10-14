import type { ReactNode } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack } from "tamagui";
import { Body, Display } from "@/components/ui.tsx";
import { colors, textAlpha } from "@/theme/colors.ts";

/**
 * The in-app destructive confirmation, used instead of the platform alert so
 * it follows the selected theme and the Court Bold shapes (rounded sheet, accent
 * ink system, Anton title). The native alert on Android is always light with
 * square corners, which broke the dark theme.
 *
 * The whole sheet is dismissable (backdrop tap and CANCEL), and the confirm
 * action is the danger fill so "this deletes something" reads instantly. The
 * `primary` tone (ink fill, accent label) is for confirmations that keep data.
 */
export function ConfirmSheet({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  tone = "danger",
}: {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly tone?: "danger" | "primary";
}): ReactNode {
  const insets = useSafeAreaInsets();
  return (
    <YStack position="absolute" top={0} left={0} right={0} bottom={0} testID="confirm-sheet">
      <View
        flex={1}
        backgroundColor="rgba(14, 17, 22, 0.55)"
        role="button"
        aria-label="Cancel"
        onPress={onCancel}
      />
      <YStack
        backgroundColor={colors.sheet}
        borderTopLeftRadius={28}
        borderTopRightRadius={28}
        paddingTop={22}
        paddingHorizontal={20}
        paddingBottom={insets.bottom + 18}
        gap={11}
        boxShadow="0 -12px 40px rgba(14, 17, 22, 0.35)"
      >
        <Display fontSize={24}>{title}</Display>
        <Body fontSize={13} fontWeight="600" color={textAlpha(0.5)}>
          {message}
        </Body>
        <XStack
          height={58}
          marginTop={4}
          backgroundColor={tone === "danger" ? colors.danger : colors.ink}
          borderRadius={17}
          alignItems="center"
          justifyContent="center"
          pressStyle={{ opacity: 0.85 }}
          role="button"
          aria-label={confirmLabel}
          onPress={onConfirm}
          testID="confirm-action"
        >
          <Display
            fontSize={17}
            letterSpacing={1.2}
            color={tone === "danger" ? colors.white : colors.accent}
          >
            {confirmLabel}
          </Display>
        </XStack>
        <XStack
          height={50}
          alignItems="center"
          justifyContent="center"
          pressStyle={{ opacity: 0.6 }}
          role="button"
          aria-label="Cancel"
          onPress={onCancel}
          testID="confirm-cancel"
        >
          <Body fontSize={13} fontWeight="700" letterSpacing={1.2} color={textAlpha(0.55)}>
            CANCEL
          </Body>
        </XStack>
      </YStack>
    </YStack>
  );
}
