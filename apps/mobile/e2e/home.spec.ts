import { expect, test } from "@playwright/test";
import { gotoHome } from "./helpers.ts";

test.describe("home screen (design 3a)", () => {
  test("renders the seeded state", async ({ page }) => {
    await gotoHome(page);

    await expect(page.getByText("Club Padel Norte")).toBeVisible();
    // The watch pill only renders when the native bridge exists — never on web.
    await expect(page.getByText("WATCH PAIRED")).toHaveCount(0);

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

  test("tab targets fill the tab bar (not just the label)", async ({ page }) => {
    await gotoHome(page);
    // Regression: the pressable used to hug the ~15pt label, so taps near the
    // edges missed. Each third of the pill must be tappable full-height.
    for (const name of ["HOME", "MATCHES", "PROFILE"]) {
      const box = await page.getByRole("link", { name }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(56);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(100);
    }
  });

  test("season calendar fills the card width and opens a day", async ({ page }) => {
    await gotoHome(page);

    await expect(page.getByText("YOUR SEASON")).toBeVisible();
    // The grid spans the card (the old GitHub-style columns left a gap) and
    // its day cells are big enough to tap.
    const gridBox = await page.getByTestId("history-grid").boundingBox();
    expect(gridBox?.width ?? 0).toBeGreaterThan(330);

    // Scroll to the end so the newest weeks sit clear of the floating tab bar
    // (on web the page scrolls as one, so the bar drifts over the content).
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const bar = await page.getByTestId("tab-profile").boundingBox();
    const cells = page.getByRole("button", { name: /^\d+ match(es)? played, \d+ won$/u });
    expect(await cells.count()).toBeGreaterThan(0);
    expect((await cells.first().boundingBox())?.width ?? 0).toBeGreaterThan(30);

    // Tap the newest day cell whose centre is clear of the bar.
    const count = await cells.count();
    let target: { x: number; y: number } | undefined;
    for (let i = count - 1; i >= 0 && target === undefined; i -= 1) {
      const box = await cells.nth(i).boundingBox();
      if (box === null || bar === null) {
        continue;
      }
      const centre = box.y + box.height / 2;
      if (centre > bar.y + bar.height + 8) {
        target = { x: box.x + box.width / 2, y: centre };
      }
    }
    expect(target).toBeDefined();
    if (target !== undefined) {
      await page.mouse.click(target.x, target.y);
    }
    await expect(page.getByText("CLOSE")).toBeVisible();
  });
});
