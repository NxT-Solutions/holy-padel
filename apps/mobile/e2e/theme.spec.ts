import { expect, test } from "@playwright/test";

/**
 * The Appearance control on Profile: selecting a theme applies immediately,
 * persists across reloads, and "System" follows the OS scheme live.
 */
test.describe("theme selection (profile appearance)", () => {
  test("dark, light and system all apply and persist", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByText("WIN RATE")).toBeVisible({ timeout: 90_000 });

    // The profile title uses the palette's text color: ink in light mode,
    // cream in dark mode — a stable read of the active theme.
    const titleColor = (): Promise<string> =>
      page
        .getByText("NICO", { exact: true })
        .first()
        .evaluate((el) => getComputedStyle(el).color);

    // Defaults to System, and the emulated OS is light.
    await expect.poll(titleColor).toBe("rgb(14, 17, 22)");

    await page.getByRole("button", { name: "Dark", exact: true }).click();
    await expect.poll(titleColor).toBe("rgb(241, 240, 234)");

    // The choice survives a reload.
    await page.reload();
    await expect(page.getByText("WIN RATE")).toBeVisible({ timeout: 90_000 });
    await expect.poll(titleColor).toBe("rgb(241, 240, 234)");

    await page.getByRole("button", { name: "Light", exact: true }).click();
    await expect.poll(titleColor).toBe("rgb(14, 17, 22)");

    // System follows the OS: light, then a live flip to dark.
    await page.getByRole("button", { name: "System", exact: true }).click();
    await expect.poll(titleColor).toBe("rgb(14, 17, 22)");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect.poll(titleColor).toBe("rgb(241, 240, 234)");
  });
});
