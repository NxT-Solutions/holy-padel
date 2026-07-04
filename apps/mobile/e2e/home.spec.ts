import { expect, test } from "@playwright/test";
import { gotoHome } from "./helpers.ts";

test.describe("home screen (design 3a)", () => {
  test("renders the seeded state", async ({ page }) => {
    await gotoHome(page);

    await expect(page.getByText("Club Padel Norte")).toBeVisible();
    await expect(page.getByText("WATCH PAIRED")).toBeVisible();

    // The seeded live match: set 1 taken 6-4, 4-3 up, 40-30 on the game.
    await expect(page.getByText("LIVE NOW")).toBeVisible();
    await expect(page.getByTestId("home-point-A")).toHaveText("40");
    await expect(page.getByTestId("home-point-B")).toHaveText("30");
    await expect(page.getByTestId("home-score-line")).toHaveText("6-4 · 4-3");
    await expect(page.getByText(/SET 2 · \d+:\d\d · COURT 4/u)).toBeVisible();

    await expect(page.getByRole("button", { name: "RESUME SCORING" })).toBeVisible();
    await expect(page.getByRole("button", { name: "NEW MATCH" })).toBeVisible();
    await expect(page.getByText("vs Marta & Leo").first()).toBeVisible();

    // Form strip: 8–4 over the season, five recent results.
    await expect(page.getByText("FORM", { exact: true })).toBeVisible();
    await expect(page.getByText("8–4")).toBeVisible();

    // The two most recent finished matches.
    await expect(page.getByText("6-3 · 7-6")).toBeVisible();
    await expect(page.getByText("4-6 · 6-7")).toBeVisible();
  });

  test("resume scoring opens the live match", async ({ page }) => {
    await gotoHome(page);
    await page.getByRole("button", { name: "RESUME SCORING" }).click();
    await expect(page).toHaveURL(/\/live\/seed-live/u);
    await expect(page.getByTestId("point-A")).toHaveText("40");
    await expect(page.getByTestId("point-B")).toHaveText("30");
  });

  test("rematch creates a fresh live match against the last opponents", async ({ page }) => {
    await gotoHome(page);
    await page.getByRole("button", { name: /REMATCH/u }).click();
    await expect(page).toHaveURL(/\/live\/match-/u);
    await expect(page.getByTestId("point-A")).toHaveText("0");
    await expect(page.getByTestId("point-B")).toHaveText("0");
    await expect(page.getByRole("button", { name: "Point Marta & Leo" })).toBeVisible();
  });

  test("recent match row opens the overview", async ({ page }) => {
    await gotoHome(page);
    await page.getByText("6-3 · 7-6").click();
    await expect(page).toHaveURL(/\/match\/seed-12/u);
    await expect(page.getByText("DEF. MARTA & LEO")).toBeVisible();
  });

  test("tab bar navigates between the three tabs", async ({ page }) => {
    await gotoHome(page);
    await page.getByRole("link", { name: "MATCHES" }).click();
    await expect(page.getByText("stored locally")).toBeVisible();
    await page.getByRole("link", { name: "PROFILE" }).click();
    await expect(page.getByText("WIN RATE")).toBeVisible();
    await page.getByRole("link", { name: "HOME" }).click();
    await expect(page.getByText("HOLA, NICO")).toBeVisible();
  });
});
