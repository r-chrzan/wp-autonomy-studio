import * as Sentry from "@sentry/nextjs";

// Browser error reporting. `NEXT_PUBLIC_*` values are inlined at build time, which is why
// this file reads `process.env` directly instead of going through `getEnv()`.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({ dsn });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
