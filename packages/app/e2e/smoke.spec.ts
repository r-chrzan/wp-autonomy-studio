import { expect, test } from "@playwright/test";
import { expectNoSeriousA11yViolations } from "./axe";

test("public home page renders and is accessible", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("h1")).toBeVisible();
  await expectNoSeriousA11yViolations(page);
});

test("admin dashboard renders and is accessible", async ({ page }) => {
  await page.goto("/admin");

  await expect(page.getByText("Dashboard")).toBeVisible();
  await expectNoSeriousA11yViolations(page);
});

test("health check reports the database as up", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok", db: "up" });
});
