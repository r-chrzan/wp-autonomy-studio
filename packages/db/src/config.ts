import { defineConfig } from "@mikro-orm/postgresql";
import { intEnv, requireEnv } from "@wpas/core";
import { entities } from "./entities";

export type OrmConfig = ReturnType<typeof defineConfig>;

/**
 * Runtime MikroORM config, built from environment variables:
 * `DATABASE_URL` (required), `DATABASE_POOL_MIN`, `DATABASE_POOL_MAX`.
 */
export function createOrmConfig(overrides: Partial<OrmConfig> = {}): OrmConfig {
  return defineConfig({
    clientUrl: requireEnv("DATABASE_URL"),
    entities: [...entities],
    pool: {
      min: intEnv("DATABASE_POOL_MIN", 0),
      max: intEnv("DATABASE_POOL_MAX", 10),
    },
    discovery: { warnWhenNoEntities: false },
    debug: process.env.NODE_ENV === "development",
    ...overrides,
  });
}
