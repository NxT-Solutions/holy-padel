import { Anton_400Regular, useFonts } from "@expo-google-fonts/anton";
import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
  Archivo_800ExtraBold,
} from "@expo-google-fonts/archivo";
import { Stack } from "expo-router";
import { hideAsync, preventAutoHideAsync } from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { TamaguiProvider } from "tamagui";
import { DbProvider } from "@/db/provider.tsx";
import { tamaguiConfig } from "@/tamagui.config.ts";
import { colors } from "@/theme/colors.ts";
import { WatchSync } from "@/watch/use-watch-sync.ts";

void preventAutoHideAsync();

/** Deep links land with the tab navigator beneath them, so back/dismiss always work. */
// biome-ignore lint/style/useNamingConvention: expo-router requires this exact export name
export const unstable_settings = {
  initialRouteName: "(tabs)",
};

export default function RootLayout(): ReactNode {
  // biome-ignore-start lint/style/useNamingConvention: Google Fonts registry names
  const [fontsLoaded] = useFonts({
    Anton_400Regular,
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
    Archivo_800ExtraBold,
  });
  // biome-ignore-end lint/style/useNamingConvention: Google Fonts registry names

  useEffect(() => {
    if (fontsLoaded) {
      void hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <DbProvider>
        <WatchSync />
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.cream },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="new-match" options={{ presentation: "modal" }} />
          <Stack.Screen name="edit-profile" options={{ presentation: "modal" }} />
          <Stack.Screen name="live/[id]" options={{ gestureEnabled: false }} />
          <Stack.Screen name="match/[id]" />
        </Stack>
      </DbProvider>
    </TamaguiProvider>
  );
}
