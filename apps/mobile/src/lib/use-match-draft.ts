import type { MatchDraft } from "@holy-padel/db";
import { saveMatchDraft } from "@holy-padel/db";
import { useEffect, useRef } from "react";
import { useDbMutation } from "@/db/provider.tsx";

/**
 * Persist the in-progress new-match setup (settings AND picked players) on
 * every change, so leaving the screen and coming back restores the work in
 * progress. The draft is cleared once a match actually starts.
 */
export function useMatchDraftPersistence(draft: MatchDraft): void {
  const mutate = useDbMutation();
  const prefill = useRef<MatchDraft | undefined>(undefined);
  useEffect(() => {
    // The first render is whatever the screen was prefilled with (saved
    // defaults, or a resumable draft). Persisting that verbatim would let a
    // stale visit shadow freshly-changed defaults — so only divergences from
    // the prefill count as work in progress.
    if (prefill.current === undefined) {
      prefill.current = draft;
      return;
    }
    if (JSON.stringify(draft) === JSON.stringify(prefill.current)) {
      return;
    }
    mutate((driver) => {
      saveMatchDraft(driver, draft);
    });
  }, [mutate, draft]);
}
