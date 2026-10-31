import type { KnipConfig } from "knip";

/** Unused files, exports and dependencies. Plugins (Next, Vitest, ESLint, ...) add entries. */
const config: KnipConfig = {
  workspaces: {
    ".": {
      entry: ["test/**/*.ts"],
    },
    "packages/app": {
      entry: ["integration/**/*.ts"],
      // CLI run by path from integration/browser.ts, not imported.
      ignoreDependencies: ["agent-browser"],
    },
    "packages/db": {
      entry: ["src/mikro-orm.config.ts"],
    },
    "packages/ui": {
      // Every component is a public entry (`@wpas/ui/admin/*`), used or not.
      entry: ["src/admin/*.tsx", "src/site/*.tsx", "src/lib/*.ts"],
      ignoreDependencies: [
        // Icon library the shadcn CLI generates imports for (components.json).
        "lucide-react",
        // Peer of the shadcn CLI and the Prettier Tailwind plugin, used from CSS.
        "tailwindcss",
      ],
    },
    "packages/core": {
      // Loaded by name as a pino transport target (`createLogger({ pretty: true })`).
      ignoreDependencies: ["pino-pretty"],
    },
  },
  // Vendored agent skills, not this app's code.
  ignore: [".agents/**"],
  ignoreExportsUsedInFile: true,
};

export default config;
