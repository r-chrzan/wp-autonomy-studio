import type * as ConfigModule from "./config";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `createOrmConfig()` reads the cached env, so each test imports a fresh module graph.
async function loadConfig(): Promise<typeof ConfigModule> {
  vi.resetModules();
  return import("./config");
}

describe("createOrmConfig", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/app");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds the connection and pool from env", async () => {
    vi.stubEnv("DATABASE_POOL_MIN", "2");
    vi.stubEnv("DATABASE_POOL_MAX", "7");
    const { createOrmConfig } = await loadConfig();

    const config = createOrmConfig();

    expect(config.clientUrl).toBe("postgresql://u:p@localhost:5432/app");
    expect(config.pool).toEqual({ min: 2, max: 7 });
    expect(config.discovery?.warnWhenNoEntities).toBe(false);
  });

  it("logs queries only in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect((await loadConfig()).createOrmConfig().debug).toBe(true);

    vi.stubEnv("NODE_ENV", "production");
    expect((await loadConfig()).createOrmConfig().debug).toBe(false);
  });

  it("applies overrides last", async () => {
    const { createOrmConfig } = await loadConfig();

    expect(createOrmConfig({ debug: true, clientUrl: "postgresql://x/y" })).toMatchObject({
      debug: true,
      clientUrl: "postgresql://x/y",
    });
  });
});
