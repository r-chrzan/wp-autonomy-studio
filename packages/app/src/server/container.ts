import "server-only";
import { asFunction, asValue, createAppContainer, type AwilixContainer } from "@wpas/core/di";
import { getEnv, type Env } from "@wpas/core/env";
import type { Logger } from "@wpas/core/logger";
import { getOrm, type EntityManager, type Orm } from "@wpas/db";
import { getLogger } from "./logger";

/** Every registration in the app container. Add new services here. */
export type Cradle = {
  env: Env;
  /** Process-wide logger. Scopes may override it with a child logger. */
  logger: Logger;
  orm: Orm;
  /** Request-scoped EntityManager fork. Resolve only from a request scope. */
  em: EntityManager;
};

export type AppContainer = AwilixContainer<Cradle>;

// Kept on globalThis so dev hot reloads reuse one container (and ORM pool).
const globalForContainer = globalThis as typeof globalThis & {
  __wpasContainer?: Promise<AppContainer>;
};

async function buildContainer(): Promise<AppContainer> {
  const container = createAppContainer<Cradle>();
  const orm = await getOrm();

  container.register({
    env: asValue(getEnv()),
    logger: asValue(getLogger()),
    orm: asValue(orm),
    em: asFunction(({ orm }: Pick<Cradle, "orm">) => orm.em.fork()).scoped(),
  });

  return container;
}

/** Composition root: the process-wide container. Server-only. */
export function getContainer(): Promise<AppContainer> {
  let container = globalForContainer.__wpasContainer;
  if (!container) {
    container = buildContainer().catch((error: unknown) => {
      globalForContainer.__wpasContainer = undefined;
      throw error;
    });
    globalForContainer.__wpasContainer = container;
  }
  return container;
}

/** Creates a scope for one request; scoped registrations (e.g. `em`) live here. */
export async function createRequestScope(): Promise<AppContainer> {
  return (await getContainer()).createScope();
}

/**
 * Runs `fn` with a fresh request scope and always disposes the scope afterwards. Use this in
 * server actions and route handlers instead of calling `createRequestScope()` directly.
 */
export async function withRequestScope<T>(fn: (scope: AppContainer) => Promise<T>): Promise<T> {
  const scope = await createRequestScope();
  try {
    return await fn(scope);
  } finally {
    await scope.dispose();
  }
}
