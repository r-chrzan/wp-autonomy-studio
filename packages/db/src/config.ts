import { defineConfig } from "@mikro-orm/postgresql";
import { getEnv } from "@wpas/core/env";
import { entities } from "./entities";

export type OrmConfig = ReturnType<typeof defineConfig>;

/**
 * Runtime MikroORM config, built from the validated env:
 * `DATABASE_URL` (required), `DATABASE_POOL_MIN`, `DATABASE_POOL_MAX`.
 */
export function createOrmConfig(overrides: Partial<OrmConfig> = {}): OrmConfig {
  const env = getEnv();
  return defineConfig({
    clientUrl: env.DATABASE_URL,
    entities: [...entities],
    pool: {
      min: env.DATABASE_POOL_MIN,
      max: env.DATABASE_POOL_MAX,
    },
    discovery: { warnWhenNoEntities: false },
    debug: env.NODE_ENV === "development",
    ...overrides,
  });
}
