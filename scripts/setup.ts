import { spawnSync } from "node:child_process";
import { constants, copyFileSync, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createConnection } from "node:net";

import { runSetup, type SetupDeps } from "./setup-steps.ts";

const CONNECT_TIMEOUT_MS = 1000;

/** The real system behind `SetupDeps`. Relative paths resolve against the repo root, npm's cwd. */
export function createRealDeps(): SetupDeps {
  return {
    exec: (command, args, options) => {
      // On Windows `npm` is a .cmd shim that spawnSync can't start without a shell, so run npm's
      // own CLI script with the current node instead; npm sets npm_execpath under `npm run`.
      // Other runners (pnpm, bun) set it to their own binary, so only trust npm's script.
      const npmCli = process.env.npm_execpath;
      const [file, fileArgs] =
        command === "npm" && npmCli?.endsWith("npm-cli.js")
          ? [process.execPath, [npmCli, ...args]]
          : [command, args];
      // Node's types omit that `stdout` is null when stdio is inherited.
      const result: { status: number | null; stdout: string | null; error?: Error } = spawnSync(
        file,
        fileArgs,
        { stdio: options?.capture ? ["ignore", "pipe", "pipe"] : "inherit", encoding: "utf8" },
      );
      // `status` is null when the command is missing or killed by a signal.
      return {
        status: result.status ?? 1,
        stdout: result.stdout ?? "",
        ...(result.error ? { error: result.error.message } : {}),
      };
    },
    exists: (path) => existsSync(path),
    mtimeMs: (path) => statSync(path).mtimeMs,
    readDir: (path) => readdirSync(path),
    readFile: (path) => readFileSync(path, "utf8"),
    copyExclusive: (from, to) => {
      copyFileSync(from, to, constants.COPYFILE_EXCL);
    },
    canConnect: (host, port) =>
      new Promise((resolve) => {
        const socket = createConnection({ host, port, timeout: CONNECT_TIMEOUT_MS });
        const finish = (reachable: boolean): void => {
          socket.destroy();
          resolve(reachable);
        };
        socket.once("connect", () => {
          finish(true);
        });
        socket.once("timeout", () => {
          finish(false);
        });
        socket.once("error", () => {
          finish(false);
        });
      }),
    // An interactive CLI that runs before dependencies (pino) are installed; see AGENTS.md.
    log: (line) => {
      console.log(line);
    },
    nodeVersion: process.version,
  };
}

process.exitCode = await runSetup(createRealDeps());
