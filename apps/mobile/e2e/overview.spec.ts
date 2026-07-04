import { expect, test } from "@playwright/test";
import { armConfirm } from "./helpers.ts";

async function gotoOverview(
  page: Parameters<typeof armConfirm>[0],
  id: string,
  marker: string,
): Promise<void> {
  await page.goto(`/match/${id}`);
  await expect(page.getByText(marker)).toBeVisible({ timeout: 90_000 });
}

test.describe("match overview (design 3d)", () => {
  test("shows the hero, set notes and totals for a tie-break win", async ({ page }) => {
    await gotoOverview(page, "seed-12", "DEF. MARTA & LEO");

    await expect(page.getByText("NICO & JAVI", { exact: true })).toBeVisible();
    await expect(page.getByTestId("overview-score")).toHaveText("6-3 · 7-6");
    await expect(page.getByText(/BEST OF 3 · ADVANTAGE/u)).toBeVisible();

    // Set rows: a break note for set 1, the tie-break score for set 2.
    await expect(page.getByText(/SET 1 · \d+ MIN/u)).toBeVisible();
    await expect(page.getByText(/Break in game \d+/u)).toBeVisible();
    await expect(page.getByText("Tie-break 7–4")).toBeVisible();

    await expect(page.getByText("MATCH TOTALS")).toBeVisible();
    await expect(page.getByText("POINTS WON")).toBeVisible();
    await expect(page.getByText("Longest game")).toBeVisible();
    await expect(page.getByText("Service games held")).toBeVisible();
    await expect(page.getByText("EXPORT")).toBeVisible();
    await expect(page.getByText("DELETE MATCH")).toBeVisible();
  });

  test("labels a super tie-break decider", async ({ page }) => {
    await gotoOverview(page, "seed-10", "Super tie-break");
    await expect(page.getByTestId("overview-score")).toHaveText("7-5 · 2-6 · 10-7");
    await expect(page.getByText(/SET 3/u)).toBeVisible();
  });

  test("delete asks first; cancel keeps the match", async ({ page }) => {
    await gotoOverview(page, "seed-12", "DEF. MARTA & LEO");
    armConfirm(page, false);
    await page.getByText("DELETE MATCH").click();
    await expect(page.getByText("DEF. MARTA & LEO")).toBeVisible();

    await page.goto("/matches");
    await expect(page.getByText("13 stored locally")).toBeVisible();
  });

  test("delete removes the match and its stats everywhere", async ({ page }) => {
    await gotoOverview(page, "seed-12", "DEF. MARTA & LEO");
    armConfirm(page, true);
    await page.getByText("DELETE MATCH").click();
    await expect(page.getByText("HOLA, NICO")).toBeVisible();

    await page.goto("/matches");
    await expect(page.getByText("12 stored locally")).toBeVisible();
    await expect(page.getByText("6-3 · 7-6")).toHaveCount(0);

    // Profile recomputes: 11 played, 7–4 now.
    await page.goto("/profile");
    await expect(page.getByText("PLAYED")).toBeVisible();
    await expect(page.getByText("7–4", { exact: true })).toBeVisible();
  });
});
