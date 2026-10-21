import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3100);

/**
 * End-to-end tests against the production build (`npm run build` first). The web server is
 * started here on its own port so it never collides with a running `next dev` (port 3000).
 * Needs a reachable database (`docker compose up -d db` + migrations).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next start --port ${port}`,
    url: `http://localhost:${port}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
