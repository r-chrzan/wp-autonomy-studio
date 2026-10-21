import { pino, type Logger, type LoggerOptions } from "pino";

export type { Logger } from "pino";

/**
 * Paths that are always replaced with "[redacted]". Extend this list rather than redacting
 * at call sites, so a forgotten call site can't leak a secret.
 */
export const redactPaths = [
  "password",
  "*.password",
  "apiKey",
  "*.apiKey",
  "secret",
  "*.secret",
  "token",
  "*.token",
  "authorization",
  "*.authorization",
  "headers.authorization",
  "headers.cookie",
  "cookie",
  "*.cookie",
] as const;

export type CreateLoggerOptions = {
  level: LoggerOptions["level"];
  /** Service name in every line, e.g. "app" or "worker". */
  service: string;
  /** Pretty, colored output for local development (needs `pino-pretty`). */
  pretty?: boolean;
  /** Write somewhere other than stdout (tests). */
  destination?: pino.DestinationStream;
};

/**
 * Creates the process logger: JSON lines to stdout with redaction. Create one per process
 * and derive per-request/job loggers with `logger.child({ requestId, orgId, ... })`.
 */
export function createLogger(options: CreateLoggerOptions): Logger {
  const config = loggerOptions(options);
  return options.destination ? pino(config, options.destination) : pino(config);
}

/** The pino options `createLogger` uses. Exported for tests. */
export function loggerOptions(options: Omit<CreateLoggerOptions, "destination">): LoggerOptions {
  return {
    level: options.level ?? "info",
    base: { service: options.service },
    redact: { paths: [...redactPaths], censor: "[redacted]" },
    ...(options.pretty ? { transport: { target: "pino-pretty" } } : {}),
  };
}
