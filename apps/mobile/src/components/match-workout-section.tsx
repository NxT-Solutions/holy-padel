import { loadMatchHeartRate, loadMatchMotion } from "@holy-padel/db";
import type { ReactNode } from "react";
import { MatchActivityCard } from "@/components/match-activity-card.tsx";
import { ScoreRaceCard } from "@/components/score-race-card.tsx";
import { useDbQuery } from "@/db/provider.tsx";
import type { GameSeries } from "@/lib/game-series.ts";

/**
 * The score race plus what the watch measured (heart rate, steps, distance)
 * for one match. Loads its own watch data so the overview screen stays lean.
 */
export function MatchWorkoutSection({
  matchId,
  matchStartedAt,
  series,
  sport,
}: {
  readonly matchId: string;
  readonly matchStartedAt: number;
  readonly series: readonly GameSeries[];
  readonly sport: "padel" | "squash" | "pickleball" | undefined;
}): ReactNode {
  const heartRate = useDbQuery((driver) => loadMatchHeartRate(driver, matchId));
  const motion = useDbQuery((driver) => loadMatchMotion(driver, matchId));
  return (
    <>
      <ScoreRaceCard
        series={series}
        sport={sport}
        matchStartedAt={matchStartedAt}
        {...(heartRate === undefined ? {} : { heartRate })}
        {...(motion === undefined ? {} : { motion })}
      />
      <MatchActivityCard
        series={series}
        matchStartedAt={matchStartedAt}
        heartRate={heartRate}
        motion={motion}
      />
    </>
  );
}
