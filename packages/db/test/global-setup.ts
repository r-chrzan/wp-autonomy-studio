import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  // Values handed from this global setup to test files via `inject()`. Module augmentation
  // needs declaration merging, so this has to be an interface.
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

let container: StartedPostgreSqlContainer | undefined;

/** Starts one PostgreSQL (same major as compose.yaml) for the whole integration run. */
export async function setup(project: TestProject): Promise<void> {
  container = await new PostgreSqlContainer("postgres:17-alpine").start();
  project.provide("databaseUrl", container.getConnectionUri());
}

export async function teardown(): Promise<void> {
  await container?.stop();
}
