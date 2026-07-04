import { expect, test } from "@playwright/test";
import { gotoHome, startNewMatch, winLoveGames } from "./helpers.ts";

async function gotoProfile(page: Parameters<typeof gotoHome>[0]): Promise<void> {
  await page.goto("/profile");
  await expect(page.getByText("WIN RATE")).toBeVisible({ timeout: 90_000 });
}

test.describe("profile tab (design 3f)", () => {
  test("computes the seeded record from the ledger", async ({ page }) => {
    await gotoProfile(page);

    await expect(page.getByText("NICO", { exact: true })).toBeVisible();
    await expect(page.getByText("Club Padel Norte · plays left side")).toBeVisible();

    // 12 finished matches, 8 won: 67%.
    await expect(page.getByText("12", { exact: true })).toBeVisible();
    await expect(page.getByText("8–4", { exact: true })).toBeVisible();
    await expect(page.getByText("67%", { exact: true })).toBeVisible();
    await expect(page.getByText("FORM · LAST 5")).toBeVisible();

    // Partner records.
    await expect(page.getByText("WITH PARTNER")).toBeVisible();
    await expect(page.getByText("Javi", { exact: true })).toBeVisible();
    await expect(page.getByText("8–3", { exact: true })).toBeVisible();
    await expect(page.getByText("Ana", { exact: true })).toBeVisible();
    await expect(page.getByText("0–1", { exact: true })).toBeVisible();

    // Head-to-head, most played first.
    await expect(page.getByText("HEAD-TO-HEAD")).toBeVisible();
    await expect(page.getByText("vs Marta & Leo")).toBeVisible();
    await expect(page.getByText("4–3", { exact: true })).toBeVisible();
    await expect(page.getByText("vs Ana & Pablo")).toBeVisible();
    await expect(page.getByText("3–1", { exact: true })).toBeVisible();
    await expect(page.getByText("vs Carla & Hugo")).toBeVisible();

    // Storage row counts every stored match, live included.
    await expect(page.getByText(/SQLite · 13 matches · .+ MB/u)).toBeVisible();
  });

  test("updates immediately after a new win", async ({ page }) => {
    await gotoHome(page);
    await startNewMatch(page, { bestOf: 1 });
    await winLoveGames(page, "A", 6);
    await page.getByRole("button", { name: "SAVE & CLOSE" }).click();
    await expect(page.getByText("HOLA, NICO")).toBeVisible();

    await gotoProfile(page);
    await expect(page.getByText("13", { exact: true })).toBeVisible();
    await expect(page.getByText("9–4", { exact: true })).toBeVisible();
    await expect(page.getByText("69%", { exact: true })).toBeVisible();
    await expect(page.getByText("9–3", { exact: true })).toBeVisible(); // with Javi
    await expect(page.getByText("5–3", { exact: true })).toBeVisible(); // vs Marta & Leo
    await expect(page.getByText(/SQLite · 14 matches/u)).toBeVisible();
  });
});
