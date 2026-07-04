import { computeMatch } from "@holy-padel/scoring";
import { describe, expect, it } from "vitest";
import {
  dayLabel,
  durationLabel,
  finalScoreLine,
  fullDayLabel,
  liveScoreLine,
  megabytesLabel,
  pairInitials,
  pairLabel,
  timeLabel,
} from "../src/lib/format.ts";

// Wednesday 2026-07-01 12:00 local time.
const NOW = new Date(2026, 6, 1, 12, 0).getTime();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe("format helpers", () => {
  it("labels pairs and initials", () => {
    expect(pairLabel(["Nico", "Javi"])).toBe("Nico & Javi");
    expect(pairInitials(["Nico", "Javi"])).toBe("N&J");
    expect(pairInitials(["marta", "leo"])).toBe("M&L");
  });

  it("labels days as TODAY, weekday, or date", () => {
    expect(dayLabel(NOW - HOUR, NOW)).toBe("TODAY");
    expect(dayLabel(NOW - DAY, NOW)).toBe("TUE");
    expect(dayLabel(NOW - 3 * DAY, NOW)).toBe("SUN");
    expect(dayLabel(NOW - 10 * DAY, NOW)).toBe("JUN 21");
  });

  it("formats times, full dates and durations", () => {
    expect(timeLabel(new Date(2026, 6, 1, 18, 5).getTime())).toBe("18:05");
    expect(fullDayLabel(new Date(2026, 5, 30, 18, 32).getTime())).toBe("TUE JUN 30");
    expect(durationLabel(47 * 60_000)).toBe("0:47");
    expect(durationLabel(83 * 60_000)).toBe("1:23");
    expect(durationLabel(0)).toBe("0:00");
  });

  it("renders live and final score lines from snapshots", () => {
    const config = {
      bestOf: 3,
      deuceMode: "advantage",
      thirdSet: "superTieBreak",
      firstServe: "A",
    } as const;
    const gameA = Array.from({ length: 4 }, (_, index) => ({
      winner: "A" as const,
      at: index,
    }));
    const live = computeMatch(config, gameA);
    expect(liveScoreLine(live)).toBe("1-0");

    const set = Array.from({ length: 24 }, (_, index) => ({
      winner: "A" as const,
      at: index,
    }));
    const oneSet = computeMatch(config, set);
    expect(liveScoreLine(oneSet)).toBe("6-0 · 0-0");
    expect(finalScoreLine(oneSet)).toBe("6-0");
  });

  it("shows super tie-break points in the live line, not a frozen 0-0", () => {
    const config = {
      bestOf: 3,
      deuceMode: "advantage",
      thirdSet: "superTieBreak",
      firstServe: "A",
    } as const;
    const oneSetAll = [
      ...Array.from({ length: 24 }, () => "A" as const),
      ...Array.from({ length: 24 }, () => "B" as const),
    ];
    const intoSuperTb = [...oneSetAll, "A", "A", "A", "B"] as const;
    const snapshot = computeMatch(
      config,
      intoSuperTb.map((winner, index) => ({ winner, at: index })),
    );
    expect(liveScoreLine(snapshot)).toBe("6-0 · 0-6 · 3-1");
  });

  it("labels storage sizes", () => {
    expect(megabytesLabel(1_258_291)).toBe("1.2 MB");
    expect(megabytesLabel(0)).toBe("0.0 MB");
  });
});
