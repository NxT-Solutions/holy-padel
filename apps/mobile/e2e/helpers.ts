import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

/** The seeded pairs used across the demo ledger. */
export const TEAM_A = "Nico & Javi";
export const TEAM_B = "Marta & Leo";

/** Open the app at the home tab and wait for the seeded database. */
export async function gotoHome(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByText("HOLA, NICO")).toBeVisible({ timeout: 90_000 });
}

/** Open a live match directly and wait for the scoreboard. */
export async function gotoLive(page: Page, id: string): Promise<void> {
  await page.goto(`/live/${id}`);
  await expect(page.getByTestId("point-A")).toBeVisible({ timeout: 90_000 });
}

/** The tap-to-score card for one team on the live screen. */
export function pointButton(page: Page, team: "A" | "B"): Locator {
  const name = team === "A" ? TEAM_A : TEAM_B;
  return page.getByRole("button", { name: `Point ${name}` });
}

/** Score `count` rallies for a team. */
export async function score(page: Page, team: "A" | "B", count = 1): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    await pointButton(page, team).click();
  }
}

/** Win one love game (four straight rallies). */
export async function winLoveGame(page: Page, team: "A" | "B"): Promise<void> {
  await score(page, team, 4);
}

/** Win `games` love games in a row. */
export async function winLoveGames(page: Page, team: "A" | "B", games: number): Promise<void> {
  for (let i = 0; i < games; i += 1) {
    await winLoveGame(page, team);
  }
}

export function statusPill(page: Page): Locator {
  return page.getByTestId("status-pill");
}

export async function expectPoints(page: Page, a: string, b: string): Promise<void> {
  await expect(page.getByTestId("point-A")).toHaveText(a);
  await expect(page.getByTestId("point-B")).toHaveText(b);
}

/** Arm the next confirm() dialog before clicking the trigger. */
export function armConfirm(page: Page, accept: boolean): void {
  page.once("dialog", (dialog) => {
    void (accept ? dialog.accept() : dialog.dismiss());
  });
}

export interface NewMatchOptions {
  readonly bestOf?: 1 | 3;
  readonly thirdSet?: "Full set" | "Super TB";
  readonly deuce?: "Advantage" | "Golden pt";
  readonly firstServe?: "Team A" | "Team B";
}

/**
 * Drive the full new-match flow from home with the seeded roster:
 * Javi joins team A, Marta & Leo form team B.
 */
export async function startNewMatch(page: Page, options: NewMatchOptions = {}): Promise<void> {
  await page.getByRole("button", { name: "NEW MATCH" }).click();
  await expect(page.getByText("Doubles · FIP scoring")).toBeVisible();

  // Team A: pick the partner.
  await page.getByText("Pick a player").first().click();
  await expect(page.getByText("PICK TEAM A")).toBeVisible();
  await page.getByRole("button", { name: /Javi/u }).click();
  await page.getByRole("button", { name: "DONE" }).click();

  // Team B: pick both opponents.
  await page.getByText("Pick a player").first().click();
  await expect(page.getByText("PICK TEAM B")).toBeVisible();
  await page.getByRole("button", { name: /Marta/u }).click();
  await page.getByRole("button", { name: /Leo/u }).click();
  await page.getByRole("button", { name: "DONE" }).click();

  if (options.bestOf !== undefined) {
    await page.getByRole("button", { name: String(options.bestOf), exact: true }).click();
  }
  if (options.thirdSet !== undefined) {
    await page.getByRole("button", { name: options.thirdSet, exact: true }).click();
  }
  if (options.deuce !== undefined) {
    await page.getByRole("button", { name: options.deuce, exact: true }).click();
  }
  if (options.firstServe !== undefined) {
    await page.getByRole("button", { name: options.firstServe, exact: true }).click();
  }

  await page.getByRole("button", { name: "START MATCH" }).click();
  await expect(page.getByTestId("point-A")).toBeVisible();
  await expectPoints(page, "0", "0");
}
