import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** The project-pinned CLI (see `packages/app/package.json`), not a global install. */
const cli = path.join(import.meta.dirname, "../../../node_modules/.bin/agent-browser");

/** WCAG 2.2 AA rule tags, per the engineering-standards spec (sections 9.4 and 10). */
const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

type CliResponse = { success: boolean; data: unknown; error: string | null };

export type A11yViolation = { id: string; impact: string | null; help: string; nodeCount: number };

/**
 * A typed handle on one isolated agent-browser session (own browser, cookies and history).
 * Create one per test file and `close()` it in `afterAll`.
 */
export type Browser = {
  open: (url: string) => Promise<{ title: string; url: string }>;
  title: () => Promise<string>;
  /** Text of the first element with this ARIA role (and accessible name, if given). */
  textByRole: (role: string, name?: string) => Promise<string>;
  /** Clicks the first element with this ARIA role and accessible name. */
  clickByRole: (role: string, name: string) => Promise<void>;
  currentUrl: () => Promise<string>;
  /** Serious and critical axe-core violations on the current page (WCAG 2.2 AA tags). */
  seriousA11yViolations: () => Promise<A11yViolation[]>;
  close: () => Promise<void>;
};

export function createBrowser(): Browser {
  const session = `wpas-it-${randomUUID()}`;

  async function run<T>(...args: string[]): Promise<T> {
    let stdout: string;
    try {
      ({ stdout } = await execFileAsync(cli, ["--session", session, ...args, "--json"]));
    } catch (error) {
      // Failed commands exit non-zero but still print the JSON error on stdout.
      stdout = (error as { stdout?: string }).stdout ?? "";
      if (!stdout) throw error;
    }
    const response = JSON.parse(stdout) as CliResponse;
    if (!response.success) {
      throw new Error(`agent-browser ${args.join(" ")}: ${response.error ?? "failed"}`);
    }
    return response.data as T;
  }

  return {
    open: (url) => run("open", url),
    title: async () => (await run<{ title: string }>("get", "title")).title,
    textByRole: async (role, name) =>
      (await run<{ text: string }>("find", "role", role, "text", ...(name ? ["--name", name] : [])))
        .text,
    clickByRole: async (role, name) => {
      await run("find", "role", role, "click", "--name", name, "--exact");
    },
    currentUrl: async () => (await run<{ url: string }>("get", "url")).url,
    seriousA11yViolations: async () => {
      const { violations } = await run<{ violations: A11yViolation[] }>(
        "a11y",
        "--tags",
        wcagTags.join(","),
      );
      return violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    },
    close: async () => {
      await run("close");
    },
  };
}
