import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("getLogger", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/app");
    vi.stubEnv("LOG_LEVEL", "warn");
    delete (globalThis as { __wpasLogger?: unknown }).__wpasLogger;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates one process logger at the configured level", async () => {
    const { getLogger } = await import("./logger");

    const logger = getLogger();

    expect(logger.level).toBe("warn");
    expect(getLogger()).toBe(logger);
  });
});
