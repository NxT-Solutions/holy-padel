import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { expectPoints, gotoHome, saveLiveMatchIfAsked, statusPill } from "./helpers.ts";

/**
 * HI-HO squash: only the server scores, a receiver's rally is a hand-out, and
 * the "choice" tie-break asks the receiving side at target-1 all. Scores here
 * are singles (Nico vs Marta) so the game target and serve sides are easy to
 * read from the two big score cards.
 */

/** Tap a team's big score card `count` times (singles names differ from the doubles helper). */
async function tap(page: Page, team: "A" | "B", count = 1): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    await page.getByTestId(`point-${team}`).click();
  }
}

async function startSquashHiho(page: Page, options: { choice?: boolean } = {}): Promise<void> {
  await gotoHome(page);
  await page.getByRole("button", { name: "NEW MATCH" }).click();
  await expect(page.getByText("Doubles · FIP scoring")).toBeVisible();

  // Format, sport and squash rules all live behind the rules sheet now.
  await page.getByRole("button", { name: "Edit match rules" }).click();
  await page.getByRole("button", { name: "Singles", exact: true }).click();
  await page.getByRole("button", { name: "Squash", exact: true }).click();
  await page.getByRole("button", { name: "HIHO", exact: true }).click();
  if (options.choice === true) {
    await page.getByRole("button", { name: "Ask at 10", exact: true }).click();
  }
  await page.getByRole("button", { name: "Use these rules" }).click();

  // Team A is the owner; pick the opponent for team B.
  await page.getByText("Pick a player").first().click();
  await expect(page.getByText("PICK TEAM B")).toBeVisible();
  await page.getByRole("button", { name: /Marta .* with you/u }).click();
  await page.getByRole("button", { name: "DONE" }).click();

  await page.getByRole("button", { name: "START MATCH" }).click();
  await saveLiveMatchIfAsked(page);
  await expect(page.getByTestId("point-A")).toBeVisible();
  await expectPoints(page, "0", "0");
}

test.describe("squash HI-HO", () => {
  test("only the server scores; a receiver's rally hands the serve over", async ({ page }) => {
    await startSquashHiho(page);
    await expect(page.getByTestId("point-A-serve-on")).toBeVisible();

    // The server scores and keeps serving.
    await tap(page, "A", 1);
    await expectPoints(page, "1", "0");
    await expect(page.getByTestId("point-A-serve-on")).toBeVisible();

    // The receiver wins a rally: a hand-out — no score, serve moves — with a
    // visible flash so the tap doesn't look dead.
    await tap(page, "B", 1);
    await expectPoints(page, "1", "0");
    await expect(page.getByTestId("hand-out-pill")).toBeVisible();
    await expect(page.getByTestId("point-B-serve-on")).toBeVisible();

    // B serves out to the target; game ball is squash's game point wording.
    await tap(page, "B", 10);
    await expectPoints(page, "1", "10");
    await expect(statusPill(page)).toHaveText("GAME BALL — MARTA");
    await tap(page, "B", 1);
    await expect(page.getByTestId("set-chip-game-1")).toHaveText("1–11");
  });

  test("the choice tie-break asks at 10-10 and short ends the game", async ({ page }) => {
    await startSquashHiho(page, { choice: true });

    // A serves out to 10-0, then hands over and B serves back to 10-10.
    await tap(page, "A", 10);
    await tap(page, "B", 1);
    await tap(page, "B", 10);
    await expectPoints(page, "10", "10");

    // The decision is mandatory before the next rally can be scored.
    await expect(page.getByText("RECEIVER'S CHOICE")).toBeVisible();
    await page.getByTestId("set-choice-one").click();
    await expect(statusPill(page)).toHaveText("SHORT · TO 11");

    // A (receiving) wins the decided rally as a hand-out, then serves it out.
    await tap(page, "A", 1);
    await expectPoints(page, "10", "10");
    await tap(page, "A", 1);
    await expect(page.getByTestId("set-chip-game-1")).toHaveText("11–10");
  });
});
