import type { TabTriggerSlotProps } from "expo-router/ui";
import { TabList, TabSlot, Tabs, TabTrigger } from "expo-router/ui";
import type { ReactNode } from "react";
import { Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View } from "tamagui";
import { Body, LiveDot } from "@/components/ui.tsx";
import { colors, whiteAlpha } from "@/theme/colors.ts";

function TabButton({
  label,
  isFocused = false,
  ref: _ref,
  ...props
}: TabTriggerSlotProps & { readonly label: string }): ReactNode {
  return (
    // testID keeps the tab tap unambiguous — "HOME" as text collides with the
    // Android system navigation bar's Home button.
    <Pressable {...props} testID={`tab-${label.toLowerCase()}`} style={{ flex: 1 }}>
      <View alignItems="center" gap={3}>
        <Body
          fontSize={11}
          fontWeight="800"
          letterSpacing={1.4}
          color={isFocused ? colors.lime : whiteAlpha(0.45)}
        >
          {label}
        </Body>
        {isFocused ? <LiveDot size={4} /> : null}
      </View>
    </Pressable>
  );
}

/** The design's floating dark pill: three labels, lime dot under the active one. */
export default function TabsLayout(): ReactNode {
  const insets = useSafeAreaInsets();
  return (
    <Tabs style={{ flex: 1, backgroundColor: colors.cream }}>
      <TabSlot />
      <TabList asChild={true}>
        <View
          position="absolute"
          left={16}
          right={16}
          bottom={insets.bottom + 8}
          height={58}
          borderRadius={999}
          backgroundColor={colors.ink}
          flexDirection="row"
          alignItems="center"
          paddingHorizontal={8}
        >
          <TabTrigger name="index" href="/" asChild={true}>
            <TabButton label="HOME" />
          </TabTrigger>
          <TabTrigger name="matches" href="/matches" asChild={true}>
            <TabButton label="MATCHES" />
          </TabTrigger>
          <TabTrigger name="profile" href="/profile" asChild={true}>
            <TabButton label="PROFILE" />
          </TabTrigger>
        </View>
      </TabList>
    </Tabs>
  );
}
