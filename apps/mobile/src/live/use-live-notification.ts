import { getSetting, setSetting } from "@holy-padel/db";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useDbMutation, useDbQuery } from "@/db/provider.tsx";
import { newMatchId } from "@/lib/navigation.ts";
import { applyWatchIntent } from "@/watch/apply-intent.ts";
import { gatherWatchInput } from "@/watch/gather-input.ts";
import type { LiveNotificationContent } from "./build-notification.ts";
import { buildLiveNotification, intentForAction } from "./build-notification.ts";
import {
  addLiveActionListener,
  hideLiveNotification,
  isLiveNotificationAvailable,
  requestLiveNotificationPermission,
  showLiveNotification,
} from "./live-notification.ts";

/** Set once the notification permission has been asked for — never nag. */
const ASKED_KEY = "liveNotificationAsked";

/**
 * Mirrors the live match into the Android notification on every ledger
 * change, and applies its buttons through the same path as watch intents. The
 * permission is asked for once, the first time a match is live.
 */
export function useLiveNotification(): void {
  const mutate = useDbMutation();
  const input = useDbQuery((driver) => gatherWatchInput(driver, Date.now()));
  const asked = useDbQuery((driver) => getSetting(driver, ASKED_KEY) !== undefined);
  const content = buildLiveNotification(input, Date.now());
  const live = content !== undefined;
  // Re-post only when what's shown changes, not on every render.
  const serialized = content === undefined ? "" : JSON.stringify(content);

  useEffect(() => {
    if (serialized === "") {
      hideLiveNotification();
    } else {
      showLiveNotification(JSON.parse(serialized) as LiveNotificationContent);
    }
  }, [serialized]);

  useEffect(() => {
    if (live && !asked && isLiveNotificationAvailable()) {
      requestLiveNotificationPermission();
      mutate((driver) => {
        setSetting(driver, ASKED_KEY, "1");
      });
    }
  }, [live, asked, mutate]);

  useEffect(
    () =>
      addLiveActionListener((action) => {
        const intent = intentForAction(action);
        if (intent !== undefined) {
          mutate((driver) => {
            applyWatchIntent(driver, intent, { now: Date.now(), newMatchId });
          });
        }
      }),
    [mutate],
  );
}

/** Mount once inside DbProvider, next to WatchSync. */
export function LiveNotificationSync(): ReactNode {
  useLiveNotification();
  return null;
}
