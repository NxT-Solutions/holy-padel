import type { MatchConfig, PointEvent } from "@holy-padel/scoring";
import { describe, expect, it } from "vitest";
import { computeGameSeries } from "../src/lib/game-series.ts";

const config: MatchConfig = {
  sport: "squash",
  bestOf: 1,
  deuceMode: "advantage",
  thirdSet: "fullSet",
  squashMode: "hiho",
  squashTarget: 11,
  squashTiebreak: "winByTwo",
  squashServeBoxes: "player",
  firstServe: "A",
  firstServePending: false,
  firstServeOriginallyUndecided: false,
};

/** A 5-rally stretch: A holds serve and scores, then B wins a hand-out. */
const events: PointEvent[] = [
  { winner: "A", at: 0 },
  { winner: "A", at: 9_000 },
  { winner: "A", at: 24_000 },
  { winner: "A", at: 25_000 },
  { winner: "B", at: 70_000 },
  { winner: "B", at: 72_000 },
  { winner: "A", at: 120_000 },
];

describe("computeGameSeries", () => {
  it("keeps real rally timestamps so the chart's x-axis is time", () => {
    const [game] = computeGameSeries(config, events);
    expect(game).toBeDefined();
    const xs = game?.steps.map((step) => step.t);
    // The gaps are wildly uneven (9s, 15s, 1s, 45s …) — the chart maps x to
    // these, so plateaus reflect how long each score stood.
    expect(xs).toEqual([0, 9_000, 24_000, 25_000, 70_000, 72_000, 120_000]);
  });

  it("flags hand-outs (serve changes) on the steps", () => {
    const [game] = computeGameSeries(config, events);
    const flags = game?.steps.map((step) => step.handOut);
    // First rally is a serve change for box purposes? No: the opener keeps
    // the server, then B's first rally takes the hand, then A takes it back.
    expect(flags).toEqual([false, false, false, false, true, false, true]);
  });
});
