import { MikroORM } from "@mikro-orm/postgresql";
import { createOrmConfig } from "./config";

// MikroORM v7 `init()` only discovers metadata; it does not open the pool.
// Connect here so a reachable database is ready and failures surface early.
async function initOrm() {
  const orm = await MikroORM.init(createOrmConfig());
  await orm.connect();
  return orm;
}

/** The ORM type as configured by `createOrmConfig()`. */
export type Orm = Awaited<ReturnType<typeof initOrm>>;

// Kept on globalThis so dev hot reloads reuse one connection pool.
const globalForOrm = globalThis as typeof globalThis & {
  __wpasOrm?: Promise<Orm>;
};

/** Returns the process-wide ORM instance, initialising it on first use. */
export function getOrm(): Promise<Orm> {
  let orm = globalForOrm.__wpasOrm;
  if (!orm) {
    orm = initOrm().catch((error: unknown) => {
      globalForOrm.__wpasOrm = undefined;
      throw error;
    });
    globalForOrm.__wpasOrm = orm;
  }
  return orm;
}

/** Closes the pool. Use in scripts and tests, not in request handlers. */
export async function closeOrm(): Promise<void> {
  const orm = globalForOrm.__wpasOrm;
  globalForOrm.__wpasOrm = undefined;
  if (orm) await (await orm).close();
}
