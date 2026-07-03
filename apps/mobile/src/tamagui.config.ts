import { defaultConfig } from "@tamagui/config/v5";
import { animations } from "@tamagui/config/v5-rn";
import { createFont, createTamagui } from "tamagui";
import { colors } from "./theme/colors.ts";

const HEADING_SIZES = {
  1: 11,
  2: 13,
  3: 15,
  4: 16,
  5: 18,
  6: 21,
  7: 24,
  8: 30,
  9: 34,
  10: 40,
  11: 58,
  12: 76,
  13: 112,
  true: 16,
} as const;

const BODY_SIZES = {
  1: 9,
  2: 10,
  3: 11,
  4: 12,
  5: 12.5,
  6: 13,
  7: 14,
  8: 15,
  9: 16,
  10: 18,
  true: 12.5,
} as const;

/** Anton — the condensed display face for numerals and headings. */
const headingFont = createFont({
  family: "Anton_400Regular",
  size: HEADING_SIZES,
  weight: { 4: "400", true: "400" },
  letterSpacing: { 4: 0.5, true: 0.5 },
  face: {
    400: { normal: "Anton_400Regular" },
  },
});

/** Archivo — UI text at weights 400-800. */
const bodyFont = createFont({
  family: "Archivo_400Regular",
  size: BODY_SIZES,
  weight: { 4: "400", 5: "500", 6: "600", 7: "700", 8: "800", true: "600" },
  face: {
    400: { normal: "Archivo_400Regular" },
    500: { normal: "Archivo_500Medium" },
    600: { normal: "Archivo_600SemiBold" },
    700: { normal: "Archivo_700Bold" },
    800: { normal: "Archivo_800ExtraBold" },
  },
});

export const tamaguiConfig = createTamagui({
  ...defaultConfig,
  animations,
  fonts: {
    heading: headingFont,
    body: bodyFont,
  },
  tokens: {
    ...defaultConfig.tokens,
    color: {
      ...defaultConfig.tokens.color,
      ...colors,
    },
  },
});

export type AppTamaguiConfig = typeof tamaguiConfig;

declare module "tamagui" {
  interface TamaguiCustomConfig extends AppTamaguiConfig {}
}
