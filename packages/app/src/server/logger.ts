import "server-only";
import { getEnv } from "@wpas/core/env";
import { createLogger, type Logger } from "@wpas/core/logger";

// Kept on globalThis so dev hot reloads reuse one logger (and one transport worker).
const globalForLogger = globalThis as typeof globalThis & { __wpasLogger?: Logger };

/**
 * The process logger. It doesn't depend on the container, so code can log even when the
 * container failed to build (e.g. database down). The container registers the same instance.
 */
export function getLogger(): Logger {
  if (!globalForLogger.__wpasLogger) {
    const env = getEnv();
    globalForLogger.__wpasLogger = createLogger({
      level: env.LOG_LEVEL,
      service: "app",
      pretty: env.NODE_ENV === "development",
    });
  }
  return globalForLogger.__wpasLogger;
}
