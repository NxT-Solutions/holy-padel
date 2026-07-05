import { expect, test } from "@playwright/test";
import { gotoHome } from "./helpers.ts";

test.describe("modal exits (dead-affordance regressions)", () => {
  test("NEW MATCH is escapable via CANCEL, and START MATCH is always present", async ({ page }) => {
    await gotoHome(page);
    await page.getByRole("button", { name: "NEW MATCH" }).click();
    await expect(page.getByText("Doubles · FIP scoring")).toBeVisible();

    // The fixed footer CTA must be on screen even before scrolling.
    await expect(page.getByRole("button", { name: "Start match" })).toBeVisible();

    // CANCEL must return home (previously there was no way out).
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("HOLA, NICO")).toBeVisible();
  });

  test("ON THIS PHONE opens the data screen with export + delete", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByText("WIN RATE")).toBeVisible({ timeout: 90_000 });

    await page.getByRole("button", { name: "Manage your data" }).click();
    await expect(page.getByText("YOUR DATA")).toBeVisible();
    await expect(page.getByTestId("export-data")).toBeVisible();
    await expect(page.getByTestId("delete-all-data")).toBeVisible();

    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByText("WIN RATE")).toBeVisible();
  });
});
