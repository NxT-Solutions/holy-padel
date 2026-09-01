import type { ReactNode } from "react";
import { XStack } from "tamagui";
import { Body, LiveDot, Pill } from "@/components/ui.tsx";
import { textAlpha } from "@/theme/colors.ts";
import type { WatchLink } from "@/watch/use-watch-connection.ts";

/**
 * Watch-connection indicators shared by the home pill and the live screen's
 * sync line — both driven by the polled connection count, never hardcoded.
 */

function syncText(link: WatchLink, paused: boolean): string {
  if (paused) {
    return "Paused — workout paused on your watch too";
  }
  if (link.count === null || link.count === 0) {
    return "Watch not connected — score here, it syncs when they reconnect";
  }
  if (link.count === 1) {
    return "Synced — your watch mirrors the score";
  }
  return `Synced — ${String(link.count)} watches connected`;
}

/** The status line under the live screen's action bar. */
export function WatchSyncLine({
  link,
  paused,
}: {
  readonly link: WatchLink;
  readonly paused: boolean;
}): ReactNode {
  if (!link.available) {
    return null;
  }
  const showDot = !paused && link.count !== null && link.count > 0;
  return (
    <XStack alignItems="center" justifyContent="center" gap={6}>
      {showDot ? <LiveDot size={6} /> : null}
      <Body fontSize={11} fontWeight="600" color={textAlpha(0.45)}>
        {syncText(link, paused)}
      </Body>
    </XStack>
  );
}

/** The home screen's header pill. */
export function WatchPill({ link }: { readonly link: WatchLink }): ReactNode {
  if (!link.available || link.count === null) {
    return null;
  }
  if (link.count === 0) {
    return (
      <Pill borderWidth={1} borderColor={textAlpha(0.1)} paddingVertical={7} paddingHorizontal={12}>
        <Body fontSize={10} fontWeight="800" letterSpacing={1.2} color={textAlpha(0.35)}>
          WATCH OFFLINE
        </Body>
      </Pill>
    );
  }
  const label = link.count === 1 ? "WATCH CONNECTED" : `${String(link.count)} WATCHES CONNECTED`;
  return (
    <Pill
      borderWidth={1}
      borderColor={textAlpha(0.14)}
      paddingVertical={7}
      paddingHorizontal={12}
      gap={6}
    >
      <LiveDot size={6} />
      <Body fontSize={10} fontWeight="800" letterSpacing={1.2} color={textAlpha(0.55)}>
        {label}
      </Body>
    </Pill>
  );
}
