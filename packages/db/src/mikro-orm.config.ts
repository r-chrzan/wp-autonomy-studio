// MikroORM CLI config (migrations). Not imported by the app, so the migrator
// stays out of the Next.js bundle. Run through the `@wpas/db` npm scripts,
// which set the working directory to this package.
import { Migrator } from "@mikro-orm/migrations";
import { createOrmConfig } from "./config";

export default createOrmConfig({
  extensions: [Migrator],
  migrations: {
    path: "./src/migrations",
    pathTs: "./src/migrations",
    snapshot: true,
  },
});
