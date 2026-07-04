import process from "node:process";
import { defineConfig, devices } from "@playwright/test";

const PORT = 8092;

/**
 * E2E suite against the Expo web build. Every test runs in a fresh browser
 * context, which means a fresh OPFS — so each test starts from the exact
 * seeded demo database.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: process.env["CI"] !== undefined,
  retries: process.env["CI"] === undefined ? 0 : 2,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: process.env["CI"] === undefined ? "list" : "github",
  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    viewport: { width: 402, height: 874 },
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npx expo start --offline --port ${String(PORT)}`,
    url: `http://localhost:${String(PORT)}`,
    reuseExistingServer: process.env["CI"] === undefined,
    timeout: 240_000,
  },
});
