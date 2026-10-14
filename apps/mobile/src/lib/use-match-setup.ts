import type { MatchDraft, NewMatchDefaults } from "@holy-padel/db";
import {
  listMatches,
  loadLastSetup,
  loadMatchDefaults,
  loadMatchDraft,
  resolveNewMatchDefaults,
} from "@holy-padel/db";
import { useCallback, useState } from "react";
import { useDbQuery } from "@/db/provider.tsx";
import type { LastSetupBySport } from "@/lib/match-setup.ts";
import { switchSport } from "@/lib/match-setup.ts";

type Sport = NewMatchDefaults["sport"];

export interface MatchSetupState {
  /** The whole rule set as one object — the new-match screen's editable setup. */
  readonly setup: NewMatchDefaults;
  /** The resumable draft the screen opened with (player prefill and note). */
  readonly draft: MatchDraft | undefined;
  readonly update: (partial: Partial<NewMatchDefaults>) => void;
  readonly applyPreset: (preset: NewMatchDefaults) => void;
  readonly setSport: (sport: Sport) => void;
}

/**
 * The new-match rule state. One `NewMatchDefaults` object (rather than a dozen
 * `useState`s) keeps the screen under Biome's per-function limits, and lets a
 * preset apply with one setState. Prefill precedence is the established one:
 * in-progress draft → saved defaults → last match's config → built-ins.
 */
export function useMatchSetup(): MatchSetupState {
  const draft = useDbQuery(loadMatchDraft);
  const savedDefaults = useDbQuery(loadMatchDefaults);
  const lastMatch = useDbQuery(listMatches)?.[0];
  const lastBySport = useDbQuery<LastSetupBySport>((driver) => ({
    padel: loadLastSetup(driver, "padel"),
    squash: loadLastSetup(driver, "squash"),
    pickleball: loadLastSetup(driver, "pickleball"),
  }));

  const [setup, setSetup] = useState<NewMatchDefaults>(() =>
    resolveNewMatchDefaults({
      ...(draft === undefined ? {} : { draft }),
      ...(savedDefaults === undefined ? {} : { saved: savedDefaults }),
      ...(lastMatch === undefined ? {} : { lastConfig: lastMatch.config }),
    }),
  );

  const update = useCallback((partial: Partial<NewMatchDefaults>): void => {
    setSetup((current) => ({ ...current, ...partial }));
  }, []);

  const applyPreset = useCallback((preset: NewMatchDefaults): void => {
    setSetup(preset);
  }, []);

  const setSport = useCallback(
    (sport: Sport): void => {
      setSetup((current) => switchSport(current, sport, lastBySport[sport]));
    },
    [lastBySport],
  );

  return { setup, draft, update, applyPreset, setSport };
}
