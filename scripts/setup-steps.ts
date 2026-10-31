import { parseEnv } from "node:util";

/**
 * The installer behind `npm run setup` (spec: .ai/specs/2026-10-31-npm-run-setup-installer.md).
 * It runs before `npm install`, so it may only use Node built-ins. Everything that touches the
 * system arrives through `SetupDeps`, which keeps every step unit-testable.
 */

export type ExecResult = { status: number; stdout: string };

export type SetupDeps = {
  /** Runs a command without a shell. `capture` collects stdout; otherwise output is inherited. */
  exec: (command: string, args: readonly string[], options?: { capture?: boolean }) => ExecResult;
  exists: (path: string) => boolean;
  mtimeMs: (path: string) => number;
  readDir: (path: string) => string[];
  readFile: (path: string) => string;
  /** Copies `from` to `to`, failing if `to` already exists. */
  copyExclusive: (from: string, to: string) => void;
  canConnect: (host: string, port: number) => Promise<boolean>;
  log: (line: string) => void;
  nodeVersion: string;
};

type Step = {
  title: string;
  isDone: () => boolean | Promise<boolean>;
  run: () => void;
};

const MIN_NODE_MAJOR = 24;
const ENV_EXAMPLE = ".env.example";
const NPM_LOCK_MARKER = "node_modules/.package-lock.json";
const DEFAULT_PG_PORT = 5432;
// Printed by the MikroORM 7 CLI when nothing is pending; anything else counts as "todo".
const NO_PENDING_MIGRATIONS = "No pending migrations";

class SetupError extends Error {}

function runOrFail(deps: SetupDeps, command: string, args: readonly string[], hint: string): void {
  if (deps.exec(command, args).status !== 0) {
    throw new SetupError(hint);
  }
}

function manifestPaths(deps: SetupDeps): string[] {
  const workspaces = deps
    .readDir("packages")
    .map((name) => `packages/${name}/package.json`)
    .filter((path) => deps.exists(path));
  return ["package.json", "package-lock.json", ...workspaces];
}

/** npm rewrites its hidden lockfile on every install, so it is newer than any manifest it read. */
function dependenciesInstalled(deps: SetupDeps): boolean {
  if (!deps.exists(NPM_LOCK_MARKER)) {
    return false;
  }
  const installedAt = deps.mtimeMs(NPM_LOCK_MARKER);
  return manifestPaths(deps).every((path) => deps.mtimeMs(path) <= installedAt);
}

function databaseAddress(deps: SetupDeps): { host: string; port: number } {
  const url = parseEnv(deps.readFile(".env")).DATABASE_URL;
  if (!url) {
    throw new SetupError("DATABASE_URL is not set in .env (see .env.example).");
  }
  const { hostname, port } = new URL(url);
  return { host: hostname, port: port ? Number(port) : DEFAULT_PG_PORT };
}

function startDatabase(deps: SetupDeps): void {
  if (deps.exec("docker", ["info"], { capture: true }).status !== 0) {
    throw new SetupError("Docker is not running. Start Docker Desktop (or the daemon) and rerun.");
  }
  if (deps.exec("docker", ["compose", "version"], { capture: true }).status !== 0) {
    throw new SetupError("Docker Compose v2 is required (`docker compose version` failed).");
  }
  runOrFail(
    deps,
    "docker",
    ["compose", "up", "-d", "--wait", "db"],
    "Could not start the database. If port 5432 is taken, set DATABASE_PORT and match DATABASE_URL.",
  );
}

function migrationsApplied(deps: SetupDeps): boolean {
  const result = deps.exec("npm", ["run", "db:migration:pending"], { capture: true });
  return result.status === 0 && result.stdout.includes(NO_PENDING_MIGRATIONS);
}

function envFileStep(deps: SetupDeps, target: string): Step {
  return {
    title: `Create ${target} from ${ENV_EXAMPLE}`,
    isDone: () => deps.exists(target),
    run: () => {
      deps.copyExclusive(ENV_EXAMPLE, target);
    },
  };
}

export function setupSteps(deps: SetupDeps): Step[] {
  return [
    {
      title: "Install dependencies",
      isDone: () => dependenciesInstalled(deps),
      run: () => {
        runOrFail(deps, "npm", ["install"], "`npm install` failed; see the output above.");
      },
    },
    envFileStep(deps, ".env"),
    envFileStep(deps, "packages/app/.env.local"),
    {
      title: "Start the database",
      isDone: () => {
        const { host, port } = databaseAddress(deps);
        return deps.canConnect(host, port);
      },
      run: () => {
        startDatabase(deps);
      },
    },
    {
      title: "Apply database migrations",
      isDone: () => migrationsApplied(deps),
      run: () => {
        runOrFail(
          deps,
          "npm",
          ["run", "db:migration:up"],
          "Migrations failed; see the output above. Rerun `npm run setup` after fixing it.",
        );
      },
    },
  ];
}

function nodeMajor(version: string): number {
  return Number(version.replace(/^v/, "").split(".")[0]);
}

/** Runs every step that isn't done yet. Returns the process exit code. */
export async function runSetup(deps: SetupDeps): Promise<number> {
  if (nodeMajor(deps.nodeVersion) < MIN_NODE_MAJOR) {
    deps.log(`✖ Node.js ${String(MIN_NODE_MAJOR)}+ is required (found ${deps.nodeVersion}).`);
    return 1;
  }

  for (const step of setupSteps(deps)) {
    try {
      if (await step.isDone()) {
        deps.log(`✔ ${step.title} — already done, skipped`);
        continue;
      }
      deps.log(`→ ${step.title}`);
      step.run();
      deps.log(`✔ ${step.title} — done`);
    } catch (error) {
      deps.log(`✖ ${step.title}: ${error instanceof Error ? error.message : String(error)}`);
      return 1;
    }
  }

  deps.log("Setup complete. Start the app with: npm run dev");
  return 0;
}
