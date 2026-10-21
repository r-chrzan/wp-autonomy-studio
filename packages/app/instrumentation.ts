import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";

/**
 * Runs once per server instance, before it handles requests:
 * 1. fails fast on an invalid environment (readable list of bad variables);
 * 2. starts Sentry when `SENTRY_DSN` is set (no DSN = error reporting off).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // `next build` also loads this file; env is validated when the server starts instead.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { getEnv } = await import("@wpas/core/env");
  const env = getEnv();

  if (env.SENTRY_DSN) {
    Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV });
  }
}

export const onRequestError: Instrumentation.onRequestError = (...args) => {
  Sentry.captureRequestError(...args);
};
