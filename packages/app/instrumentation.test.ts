import type * as Instrumentation from "./instrumentation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({ init: vi.fn(), captureRequestError: vi.fn() }));

vi.mock("@sentry/nextjs", () => sentry);

// Fresh module graph per test: `register()` imports the env module, which caches.
async function loadInstrumentation(): Promise<typeof Instrumentation> {
  vi.resetModules();
  return import("./instrumentation");
}

describe("register", () => {
  beforeEach(() => {
    sentry.init.mockReset();
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/app");
    vi.stubEnv("SENTRY_DSN", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does nothing outside the Node.js runtime", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    vi.stubEnv("DATABASE_URL", "");

    await expect((await loadInstrumentation()).register()).resolves.toBeUndefined();
  });

  it("skips validation during next build", async () => {
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    vi.stubEnv("DATABASE_URL", "");

    await expect((await loadInstrumentation()).register()).resolves.toBeUndefined();
  });

  it("fails on an invalid environment, naming the variable", async () => {
    vi.stubEnv("DATABASE_URL", "mysql://nope");

    await expect((await loadInstrumentation()).register()).rejects.toThrow(/DATABASE_URL/);
  });

  it("leaves Sentry off without a DSN", async () => {
    await (await loadInstrumentation()).register();

    expect(sentry.init).not.toHaveBeenCalled();
  });

  it("starts Sentry when SENTRY_DSN is set", async () => {
    vi.stubEnv("SENTRY_DSN", "https://key@errors.example.com/1");
    vi.stubEnv("NODE_ENV", "production");

    await (await loadInstrumentation()).register();

    expect(sentry.init).toHaveBeenCalledWith({
      dsn: "https://key@errors.example.com/1",
      environment: "production",
    });
  });
});

describe("onRequestError", () => {
  it("forwards server errors to Sentry", async () => {
    const { onRequestError } = await loadInstrumentation();
    const args = [new Error("boom"), {}, {}] as unknown as Parameters<typeof onRequestError>;

    await onRequestError(...args);

    expect(sentry.captureRequestError).toHaveBeenCalledWith(...args);
  });
});
