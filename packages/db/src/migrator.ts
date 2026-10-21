import path from "node:path";
import { Migrator } from "@mikro-orm/migrations";
import type { OrmConfig } from "./config";

/** Absolute path of the committed migrations, so it works from any working directory. */
export const migrationsPath = path.join(import.meta.dirname, "migrations");

/**
 * Config fragment that adds the migrator. Used only by the CLI config and the test database
 * helper, never by the app, so `@mikro-orm/migrations` stays out of the Next.js bundle.
 */
export function withMigrator(config: Partial<OrmConfig> = {}): Partial<OrmConfig> {
  return {
    ...config,
    extensions: [Migrator],
    migrations: { path: migrationsPath, pathTs: migrationsPath, snapshot: true },
  };
}
