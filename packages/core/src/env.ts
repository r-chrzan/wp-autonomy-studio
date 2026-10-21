import { z } from "zod";

/**
 * Every environment variable the platform reads, in one schema. Add new variables here and
 * document them in `.env.example`. Empty strings count as "not set", so `FOO=` in a `.env`
 * file falls back to the default instead of failing.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.url({
    protocol: /^postgres(ql)?$/,
    error: "must be a postgres:// or postgresql:// URL",
  }),
  DATABASE_POOL_MIN: z.coerce.number().int().min(0).default(0),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(10),

  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

  SENTRY_DSN: z.url().optional(),
});

export type Env = z.infer<typeof envSchema>;

/** Thrown when the environment doesn't match `envSchema`; lists every bad variable. */
export class EnvError extends Error {
  override readonly name = "EnvError";
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid environment:\n${issues.map((issue) => `  - ${issue}`).join("\n")}`);
    this.issues = issues;
  }
}

/** Parses `source` (default `process.env`) against `envSchema`. Pure: no caching. */
export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const withoutEmpty = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value !== ""),
  );
  const result = envSchema.safeParse(withoutEmpty);
  if (!result.success) {
    throw new EnvError(
      result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    );
  }
  return result.data;
}

let cached: Env | undefined;

/**
 * The validated environment, parsed on first use and cached for the process. Read config
 * through this, never through `process.env` directly.
 */
export function getEnv(): Env {
  cached ??= parseEnv();
  return cached;
}
