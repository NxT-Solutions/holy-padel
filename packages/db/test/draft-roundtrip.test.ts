import { describe, expect, it } from "vitest";
import { clearMatchDraft, loadMatchDraft, saveMatchDraft } from "../src/match-defaults.ts";
import { migrate } from "../src/schema.ts";
import { memoryDriver } from "./memory-driver.ts";

describe("draft round-trip", () => {
  it("restores players and squash sport", () => {
    const driver = memoryDriver();
    migrate(driver);
    saveMatchDraft(driver, {
      format: "doubles",
      bestOf: 3,
      thirdSet: "superTieBreak",
      deuceMode: "advantage",
      firstServe: "undecided",
      sport: "squash",
      squashMode: "par",
      squashTarget: 11,
      squashTiebreak: "winByTwo",
      squashServeBoxes: "player",
      pbTarget: 11,
      pbTiebreak: "winByTwo",
      teamA1: "nico",
      partner: "javi",
      teamB: ["marta", "leo"],
    });
    expect(loadMatchDraft(driver)).toMatchObject({
      sport: "squash",
      teamA1: "nico",
      partner: "javi",
      teamB: ["marta", "leo"],
    });
    clearMatchDraft(driver);
    expect(loadMatchDraft(driver)).toBeUndefined();
  });
});
