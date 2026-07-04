import { expect, test } from "@playwright/test";
import {
  expectPoints,
  gotoHome,
  score,
  startNewMatch,
  statusPill,
  winLoveGame,
  winLoveGames,
} from "./helpers.ts";

/** Reach 6-6 in the current set with alternating love games. */
async function reachSixAll(page: Parameters<typeof winLoveGame>[0]): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    await winLoveGame(page, "A");
    await winLoveGame(page, "B");
  }
}

test.describe("tie-breaks (FIP rule 1)", () => {
  test("6-6 opens a tie-break with numeric points, won by two clear", async ({ page }) => {
    await gotoHome(page);
    await startNewMatch(page, { bestOf: 1 });
    await reachSixAll(page);

    await expect(statusPill(page)).toHaveText("TIE-BREAK — SET 1");
    await expectPoints(page, "0", "0");

    // Numeric calls instead of 15/30/40.
    await score(page, "A", 3);
    await expectPoints(page, "3", "0");

    // 6-6 in the tie-break: no winner yet at 7-6, done at 8-6.
    await score(page, "B", 6);
    await expectPoints(page, "3", "6");
    await score(page, "A", 3);
    await expectPoints(page, "6", "6");
    await score(page, "A", 1);
    await expectPoints(page, "7", "6");
    await expect(page.getByText("MATCH WON")).toHaveCount(0);
    await score(page, "A", 1);

    // Recorded as a 7-6 set — best of 1, so the match is over.
    await expect(page.getByText("MATCH WON")).toBeVisible();
    await expect(page.getByTestId("won-score")).toHaveText("7-6");
  });

  test("tie-break serve rotation: one point, then two per pair", async ({ page }) => {
    await gotoHome(page);
    await startNewMatch(page, { bestOf: 1 });
    await reachSixAll(page);

    // Game 13 starts the tie-break; the rotation continues from game 12,
    // so Nico & Javi serve the first point.
    await expect(page.getByTestId("point-A-serve-on")).toBeVisible();
    await score(page, "A", 1);
    await expect(page.getByTestId("point-B-serve-on")).toBeVisible();
    await score(page, "A", 1);
    await expect(page.getByTestId("point-B-serve-on")).toBeVisible();
    await score(page, "A", 1);
    await expect(page.getByTestId("point-A-serve-on")).toBeVisible();
    await score(page, "A", 1);
    await expect(page.getByTestId("point-A-serve-on")).toBeVisible();
    await score(page, "A", 1);
    await expect(page.getByTestId("point-B-serve-on")).toBeVisible();
  });

  test("one set all forces the super tie-break to ten", async ({ page }) => {
    await gotoHome(page);
    await startNewMatch(page, { thirdSet: "Super TB" });

    await winLoveGames(page, "A", 6); // set 1: 6-0
    await winLoveGames(page, "B", 6); // set 2: 0-6

    await expect(statusPill(page)).toHaveText("SUPER TIE-BREAK");
    await expect(page.getByTestId("set-chip-super-tb")).toHaveText("0–0");

    await score(page, "A", 9);
    await score(page, "B", 8);
    await expectPoints(page, "9", "8");
    await expect(page.getByText("MATCH WON")).toHaveCount(0);
    await score(page, "A", 1); // 10-8: two clear
    await expect(page.getByText("MATCH WON")).toBeVisible();
    await expect(page.getByTestId("won-score")).toHaveText("6-0 · 0-6 · 10-8");
  });

  test("with a full third set configured, 6-6 there is a normal tie-break", async ({ page }) => {
    await gotoHome(page);
    await startNewMatch(page, { thirdSet: "Full set" });

    await winLoveGames(page, "A", 6);
    await winLoveGames(page, "B", 6);
    await reachSixAll(page);
    await expect(statusPill(page)).toHaveText("TIE-BREAK — SET 3");
    await score(page, "A", 7);
    await expect(page.getByText("MATCH WON")).toBeVisible();
    await expect(page.getByTestId("won-score")).toHaveText("6-0 · 0-6 · 7-6");
  });
});

test.describe("undo through tie-break boundaries", () => {
  test("undo steps back out of a tie-break into the 6-6 game", async ({ page }) => {
    await gotoHome(page);
    await startNewMatch(page, { bestOf: 1 });
    await reachSixAll(page);
    await expect(statusPill(page)).toHaveText("TIE-BREAK — SET 1");

    await score(page, "A", 2);
    await expectPoints(page, "2", "0");
    await page.getByRole("button", { name: "UNDO" }).click();
    await expectPoints(page, "1", "0");
    await page.getByRole("button", { name: "UNDO" }).click();
    await expectPoints(page, "0", "0");
    // One more undo leaves the tie-break: back inside game 12 at 40-0 for B.
    await page.getByRole("button", { name: "UNDO" }).click();
    await expect(statusPill(page)).toHaveText("GAME POINT — MARTA & LEO");
    await expect(page.getByTestId("set-chip-set-1")).toHaveText("6–5");

    // Replaying the point re-enters the tie-break cleanly.
    await score(page, "B", 1);
    await expect(statusPill(page)).toHaveText("TIE-BREAK — SET 1");
    await expectPoints(page, "0", "0");
  });
});
