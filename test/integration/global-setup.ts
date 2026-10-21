import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { startTestDatabase, type TestDatabase } from "@wpas/db/testing";
import type { TestProject } from "vitest/node";

const appDir = path.join(import.meta.dirname, "../../packages/app");
const startupTimeoutMs = 60_000;

let database: TestDatabase | undefined;
let server: ChildProcess | undefined;

/**
 * The ephemeral stack for the `integration` project:
 * 1. PostgreSQL in Testcontainers, with every migration applied;
 * 2. the production build of the app (`next start`) on a free port, pointed at that database.
 * Run `npm run build` first; `npm run test:integration` does both.
 */
export async function setup(project: TestProject): Promise<void> {
  if (!existsSync(path.join(appDir, ".next", "BUILD_ID"))) {
    throw new Error(
      "No production build found. Run `npm run build` (or `npm run test:integration`).",
    );
  }

  database = await startTestDatabase();
  const port = await freePort();
  const baseUrl = `http://localhost:${port}`;

  server = spawn("npx", ["next", "start", "--port", String(port)], {
    cwd: appDir,
    // Real env vars win over the app's `.env*` files, so the app uses the test database.
    env: { ...process.env, DATABASE_URL: database.url, NODE_ENV: "production", LOG_LEVEL: "warn" },
    stdio: ["ignore", "inherit", "inherit"],
    detached: true,
  });

  await waitForHealthy(`${baseUrl}/api/health`);
  project.provide("databaseUrl", database.url);
  project.provide("baseUrl", baseUrl);
}

export async function teardown(): Promise<void> {
  if (server?.pid !== undefined) {
    // `npx` spawns `next`; kill the whole process group so no server outlives the run.
    process.kill(-server.pid, "SIGTERM");
  }
  await database?.stop();
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, () => {
      const address = probe.address();
      probe.close(() => {
        if (address && typeof address === "object") resolve(address.port);
        else reject(new Error("Could not determine a free port"));
      });
    });
  });
}

async function waitForHealthy(url: string): Promise<void> {
  const deadline = Date.now() + startupTimeoutMs;
  while (Date.now() < deadline) {
    if (server?.exitCode !== null) throw new Error(`App server exited with ${server?.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Not listening yet.
    }
    await sleep(250);
  }
  throw new Error(`App did not become healthy at ${url} within ${startupTimeoutMs} ms`);
}
