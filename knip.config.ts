import type { KnipConfig } from "knip";

/** Unused files, exports and dependencies. Plugins (Next, Vitest, ESLint, ...) add entries. */
const config: KnipConfig = {
  workspaces: {
    "packages/app": {
      entry: ["e2e/**/*.ts"],
    },
    "packages/db": {
      entry: ["src/mikro-orm.config.ts", "test/*.ts"],
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
  ignoreExportsUsedInFile: true,
};

export default config;
