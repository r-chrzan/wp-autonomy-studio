import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { MikroORM, defineConfig } from "@mikro-orm/postgresql";
import { entities } from "../entities";
import { withMigrator } from "../migrator";

/** PostgreSQL image for tests; keep the major in sync with `compose.yaml`. */
const postgresImage = "postgres:17-alpine";

export type TestDatabase = {
  /** Connection URL to use as `DATABASE_URL`. */
  url: string;
  /** Stops and removes the container. */
  stop: () => Promise<void>;
};

/**
 * Test support (needs Docker): starts a throwaway PostgreSQL in Testcontainers and applies every
 * committed migration, so tests run against the real schema. Import from test setup only.
 */
export async function startTestDatabase(): Promise<TestDatabase> {
  const container = await new PostgreSqlContainer(postgresImage).start();
  const url = container.getConnectionUri();

  const orm = await MikroORM.init(
    defineConfig({
      clientUrl: url,
      entities: [...entities],
      discovery: { warnWhenNoEntities: false },
      ...withMigrator(),
    }),
  );
  try {
    await orm.migrator.up();
  } finally {
    await orm.close();
  }

  return {
    url,
    stop: async () => {
      await container.stop();
    },
  };
}
