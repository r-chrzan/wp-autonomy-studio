import { EventEmitter } from "node:events";

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { SetupDeps } from "./setup-steps.ts";

const mocks = vi.hoisted(() => ({
  runSetup: vi.fn(() => Promise.resolve(7)),
  spawnSync: vi.fn(),
  copyFileSync: vi.fn(),
  existsSync: vi.fn(() => true),
  readdirSync: vi.fn(() => ["app"]),
  readFileSync: vi.fn(() => "DATABASE_URL=x"),
  statSync: vi.fn(() => ({ mtimeMs: 42 })),
  createConnection: vi.fn(),
}));

vi.mock("./setup-steps.ts", () => ({ runSetup: mocks.runSetup }));
vi.mock("node:child_process", () => ({ spawnSync: mocks.spawnSync }));
vi.mock("node:net", () => ({ createConnection: mocks.createConnection }));
vi.mock("node:fs", () => ({
  constants: { COPYFILE_EXCL: 1 },
  copyFileSync: mocks.copyFileSync,
  existsSync: mocks.existsSync,
  readdirSync: mocks.readdirSync,
  readFileSync: mocks.readFileSync,
  statSync: mocks.statSync,
}));

let deps: SetupDeps;
let runCalls = 0;
let exitCode: typeof process.exitCode;

beforeAll(async () => {
  await import("./setup.ts");
  const call = mocks.runSetup.mock.calls[0] as unknown as [SetupDeps] | undefined;
  if (!call) throw new Error("runSetup was not called");
  deps = call[0];
  // Mocks are cleared before each test, so record the import-time effects now.
  runCalls = mocks.runSetup.mock.calls.length;
  exitCode = process.exitCode;
});

afterEach(() => {
  process.exitCode = undefined;
});

function fakeSocket(
  event: "connect" | "timeout" | "error",
): EventEmitter & { destroy: () => void } {
  const socket = Object.assign(new EventEmitter(), { destroy: vi.fn() });
  queueMicrotask(() => socket.emit(event, new Error("x")));
  return socket;
}

describe("setup entry", () => {
  it("runs the installer with the real deps and sets the exit code", () => {
    expect(runCalls).toBe(1);
    expect(exitCode).toBe(7);
    expect(deps.nodeVersion).toBe(process.version);
  });

  it("execs without a shell, inheriting or capturing output", () => {
    mocks.spawnSync.mockReturnValueOnce({ status: 0, stdout: null });
    expect(deps.exec("npm", ["install"])).toEqual({ status: 0, stdout: "" });
    expect(mocks.spawnSync).toHaveBeenLastCalledWith("npm", ["install"], {
      stdio: "inherit",
      encoding: "utf8",
    });

    mocks.spawnSync.mockReturnValueOnce({ status: null, stdout: "out" });
    expect(deps.exec("docker", ["info"], { capture: true })).toEqual({ status: 1, stdout: "out" });
    expect(mocks.spawnSync).toHaveBeenLastCalledWith("docker", ["info"], {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    });
  });

  it("maps the filesystem helpers onto node:fs", () => {
    expect(deps.exists(".env")).toBe(true);
    expect(deps.mtimeMs("package.json")).toBe(42);
    expect(deps.readDir("packages")).toEqual(["app"]);
    expect(deps.readFile(".env")).toBe("DATABASE_URL=x");
    expect(mocks.readFileSync).toHaveBeenCalledWith(".env", "utf8");

    deps.copyExclusive(".env.example", ".env");
    expect(mocks.copyFileSync).toHaveBeenCalledWith(".env.example", ".env", 1);
  });

  it.each([
    ["connect", true],
    ["timeout", false],
    ["error", false],
  ] as const)("canConnect resolves %s as %s and closes the socket", async (event, reachable) => {
    const socket = fakeSocket(event);
    mocks.createConnection.mockReturnValueOnce(socket);

    await expect(deps.canConnect("localhost", 5432)).resolves.toBe(reachable);

    expect(mocks.createConnection).toHaveBeenLastCalledWith({
      host: "localhost",
      port: 5432,
      timeout: 1000,
    });
    expect(socket.destroy).toHaveBeenCalled();
  });

  it("logs to stdout", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    deps.log("hello");

    expect(log).toHaveBeenCalledWith("hello");
    log.mockRestore();
  });
});
