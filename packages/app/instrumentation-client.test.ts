import type * as ClientInstrumentation from "./instrumentation-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({ init: vi.fn(), captureRouterTransitionStart: vi.fn() }));

vi.mock("@sentry/nextjs", () => sentry);

// The file runs at import time, so each test imports it fresh.
async function loadClientInstrumentation(): Promise<typeof ClientInstrumentation> {
  vi.resetModules();
  return import("./instrumentation-client");
}

describe("browser instrumentation", () => {
  beforeEach(() => {
    sentry.init.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("leaves Sentry off without NEXT_PUBLIC_SENTRY_DSN", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");

    await loadClientInstrumentation();

    expect(sentry.init).not.toHaveBeenCalled();
  });

  it("starts Sentry with the public DSN and reports router transitions", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://key@errors.example.com/2");

    const { onRouterTransitionStart } = await loadClientInstrumentation();

    expect(sentry.init).toHaveBeenCalledWith({ dsn: "https://key@errors.example.com/2" });
    expect(onRouterTransitionStart).toBe(sentry.captureRouterTransitionStart);
  });
});
