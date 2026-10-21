// MikroORM CLI config (migrations). Not imported by the app, so the migrator
// stays out of the Next.js bundle. Run through the `@wpas/db` npm scripts.
import { createOrmConfig } from "./config";
import { withMigrator } from "./migrator";

export default createOrmConfig(withMigrator());
