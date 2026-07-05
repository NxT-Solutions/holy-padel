import type { ReactNode } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack } from "tamagui";
import { Square } from "@/components/icons.tsx";
import { Body, Display } from "@/components/ui.tsx";
import { colors, inkAlpha } from "@/theme/colors.ts";

/**
 * The END sheet — the crux of "don't lose the score". Court time runs out
 * mid-match all the time, so stopping must SAVE by default (whoever's ahead is
 * credited). Fully discarding stays available, one step down, and the whole
 * sheet is dismissable so END never traps you. In-app (not a native alert) so it
 * looks the same everywhere and is directly tappable in tests.
 */
export function EndSheet({
  onStopSave,
  onDiscard,
  onCancel,
}: {
  readonly onStopSave: () => void;
  readonly onDiscard: () => void;
  readonly onCancel: () => void;
}): ReactNode {
  const insets = useSafeAreaInsets();
  return (
    <YStack position="absolute" top={0} left={0} right={0} bottom={0}>
      <View flex={1} backgroundColor="rgba(14, 17, 22, 0.55)" onPress={onCancel} />
      <YStack
        backgroundColor={colors.cream}
        borderTopLeftRadius={26}
        borderTopRightRadius={26}
        paddingTop={22}
        paddingHorizontal={20}
        paddingBottom={insets.bottom + 18}
        gap={11}
      >
        <Display fontSize={24}>END THE MATCH?</Display>
        <Body fontSize={13} fontWeight="600" color={inkAlpha(0.5)}>
          Court time up? Stop and keep the score as it stands. Or discard the match entirely.
        </Body>
        <XStack
          height={60}
          marginTop={4}
          backgroundColor={colors.lime}
          borderRadius={17}
          alignItems="center"
          justifyContent="center"
          gap={10}
          boxShadow="0 6px 18px rgba(198, 241, 53, 0.45)"
          pressStyle={{ opacity: 0.85 }}
          role="button"
          aria-label="Stop and save"
          onPress={onStopSave}
          testID="end-stop-save"
        >
          <Square size={17} color={colors.ink} />
          <Display fontSize={18} letterSpacing={1.2} color={colors.ink}>
            STOP & SAVE
          </Display>
        </XStack>
        <XStack
          height={54}
          borderWidth={1}
          borderColor={colors.danger}
          borderRadius={15}
          alignItems="center"
          justifyContent="center"
          pressStyle={{ opacity: 0.7 }}
          role="button"
          aria-label="Discard match"
          onPress={onDiscard}
          testID="end-discard"
        >
          <Body fontSize={14} fontWeight="800" letterSpacing={1.2} color={colors.danger}>
            DISCARD MATCH
          </Body>
        </XStack>
        <XStack
          height={50}
          alignItems="center"
          justifyContent="center"
          pressStyle={{ opacity: 0.6 }}
          role="button"
          aria-label="Keep playing"
          onPress={onCancel}
          testID="end-keep-playing"
        >
          <Body fontSize={13} fontWeight="700" letterSpacing={1.2} color={inkAlpha(0.55)}>
            KEEP PLAYING
          </Body>
        </XStack>
      </YStack>
    </YStack>
  );
}
