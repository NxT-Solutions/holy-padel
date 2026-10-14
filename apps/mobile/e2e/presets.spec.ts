import { expect, test } from "@playwright/test";
import { gotoHome } from "./helpers.ts";

/**
 * The fast path on New Match: a saved preset fills every rule at once, and a
 * recent opponent fills Team B — the two shortcuts that replace tapping
 * through the rules.
 */
test.describe("saved presets and recent opponents", () => {
  test("a saved preset fills the rules and reverts a change when re-applied", async ({ page }) => {
    await gotoHome(page);
    await page.getByRole("button", { name: "NEW MATCH" }).click();
    await expect(page.getByText("Doubles · FIP scoring")).toBeVisible();

    // Save the current padel doubles setup as a preset.
    await page.getByRole("button", { name: "Save setup as preset" }).click();
    await expect(page.getByTestId("preset-name")).toHaveValue("Padel · Doubles");
    await page.getByTestId("preset-name").fill("Club night");
    await page.getByTestId("save-preset").click();
    await expect(page.getByRole("button", { name: "Club night" })).toBeVisible();

    // Change a rule in the sheet — the summary follows immediately.
    await page.getByRole("button", { name: "Edit match rules" }).click();
    await page.getByRole("button", { name: "Golden pt", exact: true }).click();
    await page.getByRole("button", { name: "Use these rules" }).click();
    await expect(page.getByTestId("rules-summary")).toContainText("Golden pt");

    // Tapping the preset puts every rule back.
    await page.getByRole("button", { name: "Club night" }).click();
    await expect(page.getByTestId("rules-summary")).toContainText("Advantage");
    await expect(page.getByTestId("rules-summary")).not.toContainText("Golden pt");
  });

  test("overwriting a preset by name keeps a single chip", async ({ page }) => {
    await gotoHome(page);
    await page.getByRole("button", { name: "NEW MATCH" }).click();

    const save = async (name: string): Promise<void> => {
      await page.getByRole("button", { name: "Save setup as preset" }).click();
      await page.getByTestId("preset-name").fill(name);
      await page.getByTestId("save-preset").click();
    };
    await save("Club night");
    await save("club NIGHT");
    await expect(page.getByRole("button", { name: /club night/iu })).toHaveCount(1);
  });

  test("long-pressing a preset asks to delete it", async ({ page }) => {
    await gotoHome(page);
    await page.getByRole("button", { name: "NEW MATCH" }).click();

    await page.getByRole("button", { name: "Save setup as preset" }).click();
    await page.getByTestId("preset-name").fill("Club night");
    await page.getByTestId("save-preset").click();
    const chip = page.getByRole("button", { name: "Club night" });
    await expect(chip).toBeVisible();

    // Long press (the chip's delayLongPress) opens the delete confirm.
    await chip.click({ delay: 800 });
    await expect(page.getByText("DELETE PRESET?")).toBeVisible();
    await page.getByTestId("confirm-action").click();
    await expect(page.getByRole("button", { name: "Club night" })).toHaveCount(0);
  });

  test("a recent opponent chip fills Team B", async ({ page }) => {
    await gotoHome(page);
    await page.getByRole("button", { name: "NEW MATCH" }).click();

    await expect(page.getByTestId("recent-opponents")).toBeVisible();
    await page.getByRole("button", { name: "Play Ana & Pablo" }).click();

    // Both opponents land on the Team B card.
    await expect(page.getByText("Ana", { exact: true })).toBeVisible();
    await expect(page.getByText("Pablo", { exact: true })).toBeVisible();
  });
});
