import { describe, expect, it } from "vitest";

import { runSetup, type ExecResult, type SetupDeps } from "./setup-steps.ts";

const DB_URL = "postgresql://wpas:wpas@localhost:5432/wpas";

type Fake = {
  deps: SetupDeps;
  files: Map<string, { content: string; mtime: number }>;
  commands: string[];
  lines: string[];
  connections: string[];
};

/**
 * In-memory checkout. `exec` answers by command line; unknown commands succeed with no output.
 * Defaults describe a fresh clone with a reachable-on-start database.
 */
function fakeEnv(
  options: {
    files?: Record<string, string | { content: string; mtime: number }>;
    exec?: Record<string, Partial<ExecResult>>;
    dbUp?: boolean;
    nodeVersion?: string;
  } = {},
): Fake {
  const files = new Map<string, { content: string; mtime: number }>();
  const initial = {
    ".env.example": `DATABASE_URL=${DB_URL}\n`,
    "package.json": { content: "{}", mtime: 10 },
    "package-lock.json": { content: "{}", mtime: 10 },
    "packages/app/package.json": { content: "{}", mtime: 10 },
    ...options.files,
  };
  for (const [path, value] of Object.entries(initial)) {
    files.set(path, typeof value === "string" ? { content: value, mtime: 1 } : value);
  }

  const commands: string[] = [];
  const lines: string[] = [];
  const connections: string[] = [];
  let dbUp = options.dbUp ?? false;

  const deps: SetupDeps = {
    exec: (command, args) => {
      const line = [command, ...args].join(" ");
      commands.push(line);
      const result = { status: 0, stdout: "", ...options.exec?.[line] };
      if (line === "npm install" && result.status === 0) {
        files.set("node_modules/.package-lock.json", { content: "{}", mtime: 100 });
      }
      if (line === "docker compose up -d --wait db" && result.status === 0) {
        dbUp = true;
      }
      return result;
    },
    exists: (path) => files.has(path),
    mtimeMs: (path) => files.get(path)?.mtime ?? 0,
    readDir: (path) =>
      [
        ...new Set(
          [...files.keys()]
            .filter((f) => f.startsWith(`${path}/`))
            .map((f) => f.split("/")[1] ?? ""),
        ),
      ].concat("README.md"),
    readFile: (path) => files.get(path)?.content ?? "",
    copyExclusive: (from, to) => {
      if (files.has(to)) throw new Error(`EEXIST: ${to}`);
      files.set(to, { content: files.get(from)?.content ?? "", mtime: 50 });
    },
    canConnect: (host, port) => {
      connections.push(`${host}:${String(port)}`);
      return Promise.resolve(dbUp);
    },
    log: (line) => lines.push(line),
    nodeVersion: options.nodeVersion ?? "v24.11.0",
  };
  return { deps, files, commands, lines, connections };
}

const doneCheckout = {
  "node_modules/.package-lock.json": { content: "{}", mtime: 100 },
  ".env": "DATABASE_URL=postgresql://custom:secret@db.local:6543/custom\n",
  "packages/app/.env.local": "CUSTOM=1\n",
};
const noPending = {
  "npm run db:migration:pending": { stdout: "> pending\nNo pending migrations\n" },
};

describe("runSetup", () => {
  it("runs every step on a fresh clone", async () => {
    const env = fakeEnv();

    await expect(runSetup(env.deps)).resolves.toBe(0);

    expect(env.commands).toEqual([
      "npm install",
      "docker info",
      "docker compose version",
      "docker compose up -d --wait db",
      "npm run db:migration:pending",
      "npm run db:migration:up",
    ]);
    expect(env.files.get(".env")?.content).toBe(`DATABASE_URL=${DB_URL}\n`);
    expect(env.files.get("packages/app/.env.local")?.content).toBe(`DATABASE_URL=${DB_URL}\n`);
    expect(env.connections).toEqual(["localhost:5432"]);
    expect(env.lines).toEqual([
      "→ Install dependencies",
      "✔ Install dependencies — done",
      "→ Create .env from .env.example",
      "✔ Create .env from .env.example — done",
      "→ Create packages/app/.env.local from .env.example",
      "✔ Create packages/app/.env.local from .env.example — done",
      "→ Start the database",
      "✔ Start the database — done",
      "→ Apply database migrations",
      "✔ Apply database migrations — done",
      "Setup complete. Start the app with: npm run dev",
    ]);
  });

  it("skips every step when the checkout is already set up, leaving env files untouched", async () => {
    const env = fakeEnv({ files: doneCheckout, exec: noPending, dbUp: true });

    await expect(runSetup(env.deps)).resolves.toBe(0);

    expect(env.commands).toEqual(["npm run db:migration:pending"]);
    expect(env.files.get(".env")?.content).toBe(doneCheckout[".env"]);
    expect(env.files.get("packages/app/.env.local")?.content).toBe("CUSTOM=1\n");
    expect(env.connections).toEqual(["db.local:6543"]);
    expect(env.lines.filter((l) => l.endsWith("already done, skipped"))).toHaveLength(5);
  });

  it("is idempotent: a second run skips what the first one did", async () => {
    const env = fakeEnv();
    await runSetup(env.deps);
    env.commands.length = 0;
    env.lines.length = 0;
    Object.assign(env.deps, {
      exec: (command: string, args: readonly string[]) => {
        env.commands.push([command, ...args].join(" "));
        return { status: 0, stdout: "No pending migrations" };
      },
    });

    await expect(runSetup(env.deps)).resolves.toBe(0);

    expect(env.commands).toEqual(["npm run db:migration:pending"]);
    expect(env.lines.at(-1)).toBe("Setup complete. Start the app with: npm run dev");
  });

  it("reinstalls when any manifest is newer than the last install", async () => {
    const env = fakeEnv({
      files: { ...doneCheckout, "packages/app/package.json": { content: "{}", mtime: 200 } },
      exec: noPending,
      dbUp: true,
    });

    await runSetup(env.deps);

    expect(env.commands[0]).toBe("npm install");
  });

  it("uses the default Postgres port when DATABASE_URL has none", async () => {
    const env = fakeEnv({
      files: { ...doneCheckout, ".env": "DATABASE_URL=postgresql://u:p@localhost/db\n" },
      exec: noPending,
      dbUp: true,
    });

    await runSetup(env.deps);

    expect(env.connections).toEqual(["localhost:5432"]);
  });

  it("applies migrations when the pending check fails or lists migrations", async () => {
    for (const pending of [{ status: 1 }, { stdout: "│ Migration20261020 │" }]) {
      const env = fakeEnv({
        files: doneCheckout,
        exec: { "npm run db:migration:pending": pending },
        dbUp: true,
      });

      await runSetup(env.deps);

      expect(env.commands).toContain("npm run db:migration:up");
    }
  });

  it("refuses to run on Node older than 24, before changing anything", async () => {
    const env = fakeEnv({ nodeVersion: "v22.11.0" });

    await expect(runSetup(env.deps)).resolves.toBe(1);

    expect(env.commands).toEqual([]);
    expect(env.lines).toEqual(["✖ Node.js 24+ is required (found v22.11.0)."]);
  });

  it.each([
    [
      "npm install",
      { "npm install": { status: 1 } },
      "✖ Install dependencies: `npm install` failed",
    ],
    [
      "docker info",
      { "docker info": { status: 1 } },
      "✖ Start the database: Docker is not running",
    ],
    [
      "docker compose version",
      { "docker compose version": { status: 1 } },
      "✖ Start the database: Docker Compose v2 is required",
    ],
    [
      "docker compose up",
      { "docker compose up -d --wait db": { status: 1 } },
      "✖ Start the database: Could not start the database",
    ],
    [
      "db:migration:up",
      { "npm run db:migration:up": { status: 1 } },
      "✖ Apply database migrations: Migrations failed",
    ],
  ])("stops with exit code 1 when %s fails", async (_name, exec, message) => {
    const env = fakeEnv({ exec });

    await expect(runSetup(env.deps)).resolves.toBe(1);

    expect(env.lines.at(-1)).toContain(message);
    expect(env.lines).not.toContain("Setup complete. Start the app with: npm run dev");
  });

  it("stops when .env has no DATABASE_URL", async () => {
    const env = fakeEnv({ files: { ...doneCheckout, ".env": "LOG_LEVEL=info\n" } });

    await expect(runSetup(env.deps)).resolves.toBe(1);

    expect(env.lines.at(-1)).toBe(
      "✖ Start the database: DATABASE_URL is not set in .env (see .env.example).",
    );
  });

  it("reports non-Error failures from a step", async () => {
    const env = fakeEnv();
    env.deps.copyExclusive = () => {
      // Reproduces a dependency that throws a bare value.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw "disk full";
    };

    await expect(runSetup(env.deps)).resolves.toBe(1);

    expect(env.lines.at(-1)).toBe("✖ Create .env from .env.example: disk full");
  });
});
