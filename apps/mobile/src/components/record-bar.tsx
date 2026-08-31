import type { ReactNode } from "react";
import { View } from "tamagui";
import { colors } from "@/theme/colors.ts";

/** The W/L share bar from the partner and player screens. */
export function RecordBar({
  won,
  lost,
}: {
  readonly won: number;
  readonly lost: number;
}): ReactNode {
  const total = won + lost;
  const share = total === 0 ? 0 : won / total;
  return (
    <View
      width={104}
      height={7}
      borderRadius={999}
      backgroundColor={colors.greige}
      overflow="hidden"
    >
      <View width={`${String(share * 100)}%`} height="100%" backgroundColor={colors.lime} />
    </View>
  );
}
