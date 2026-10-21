import { afterAll, beforeAll, describe, expect, it, inject } from "vitest";
import { createBrowser, type Browser } from "./browser";

const baseUrl = inject("baseUrl");

describe("app on an ephemeral database", () => {
  let browser: Browser;

  beforeAll(() => {
    browser = createBrowser();
  });

  afterAll(async () => {
    await browser.close();
  });

  it("serves the public home page, accessibly", async () => {
    await browser.open(`${baseUrl}/`);

    expect(await browser.title()).toBe("WP Autonomy Studio");
    expect(await browser.textByRole("heading")).toBe("WP Autonomy Studio");
    expect(await browser.seriousA11yViolations()).toEqual([]);
  });

  it("navigates from the home page to the admin dashboard, accessibly", async () => {
    await browser.open(`${baseUrl}/`);
    await browser.clickByRole("link", "Open admin");

    await expect.poll(() => browser.currentUrl()).toBe(`${baseUrl}/admin`);
    expect(await browser.textByRole("heading")).toBe("Dashboard");
    expect(await browser.seriousA11yViolations()).toEqual([]);
  });

  it("reports the database as up through the health check", async () => {
    const response = await fetch(`${baseUrl}/api/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", db: "up" });
  });
});
