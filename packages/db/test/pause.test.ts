import { describe, expect, it } from "vitest";
import { createMatch, finishMatch, getMatch, pauseMatch, resumeMatch } from "../src/index.ts";
import { newMatch, seededDriver } from "./fixtures.ts";

describe("pause / resume", () => {
  it("starts unpaused with zero paused time", () => {
    const driver = seededDriver();
    createMatch(driver, newMatch("m1", { startedAt: 1000 }));
    const match = getMatch(driver, "m1");
    expect(match?.pausedMs).toBe(0);
    expect(match?.pausedAt).toBeUndefined();
  });

  it("records the pause start, then banks the interval on resume", () => {
    const driver = seededDriver();
    createMatch(driver, newMatch("m1", { startedAt: 1000 }));

    pauseMatch(driver, "m1", 5000);
    expect(getMatch(driver, "m1")?.pausedAt).toBe(5000);

    resumeMatch(driver, "m1", 8000); // paused for 3000 ms
    const match = getMatch(driver, "m1");
    expect(match?.pausedAt).toBeUndefined();
    expect(match?.pausedMs).toBe(3000);
  });

  it("accumulates across multiple pauses", () => {
    const driver = seededDriver();
    createMatch(driver, newMatch("m1", { startedAt: 0 }));
    pauseMatch(driver, "m1", 1000);
    resumeMatch(driver, "m1", 3000); // +2000
    pauseMatch(driver, "m1", 10_000);
    resumeMatch(driver, "m1", 10_500); // +500
    expect(getMatch(driver, "m1")?.pausedMs).toBe(2500);
  });

  it("is idempotent — double pause and stray resume are no-ops", () => {
    const driver = seededDriver();
    createMatch(driver, newMatch("m1", { startedAt: 0 }));

    resumeMatch(driver, "m1", 500); // not paused → no-op
    expect(getMatch(driver, "m1")?.pausedMs).toBe(0);

    pauseMatch(driver, "m1", 1000);
    pauseMatch(driver, "m1", 2000); // already paused → keeps the first start
    expect(getMatch(driver, "m1")?.pausedAt).toBe(1000);
  });

  it("finishing while paused banks the open interval up to the end time", () => {
    const driver = seededDriver();
    createMatch(driver, newMatch("m1", { startedAt: 0 }));
    pauseMatch(driver, "m1", 4000);

    finishMatch(driver, "m1", { winner: "A", endedAt: 6000, scoreLine: "6-0 6-0" });

    const match = getMatch(driver, "m1");
    expect(match?.status).toBe("finished");
    expect(match?.pausedAt).toBeUndefined();
    expect(match?.pausedMs).toBe(2000); // 6000 − 4000
  });
});
