import { Anton_400Regular, useFonts } from "@expo-google-fonts/anton";
import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
  Archivo_800ExtraBold,
} from "@expo-google-fonts/archivo";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { TamaguiProvider } from "tamagui";
import { DbProvider } from "@/db/provider.tsx";
import { tamaguiConfig } from "@/tamagui.config.ts";
import { colors } from "@/theme/colors.ts";

SplashScreen.preventAutoHideAsync();

export default function RootLayout(): ReactNode {
  const [fontsLoaded] = useFonts({
    Anton_400Regular,
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
    Archivo_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <DbProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.cream },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="new-match" options={{ presentation: "modal" }} />
          <Stack.Screen name="live/[id]" options={{ gestureEnabled: false }} />
          <Stack.Screen name="match/[id]" />
        </Stack>
      </DbProvider>
    </TamaguiProvider>
  );
}
