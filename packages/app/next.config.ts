import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  // Workspace packages (@wpas/*) ship TypeScript source; Turbopack transpiles
  // them automatically. The root must be the monorepo root to resolve them.
  turbopack: {
    root: path.join(import.meta.dirname, "../.."),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // MikroORM loads drivers dynamically; keep it out of the server bundle.
  serverExternalPackages: ["@mikro-orm/postgresql"],
};

export default nextConfig;
