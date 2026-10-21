import { describe, expect, it } from "vitest";
import { EnvError, parseEnv } from "./env";

const valid = { DATABASE_URL: "postgresql://u:p@localhost:5432/db" };

describe("parseEnv", () => {
  it("applies defaults for optional variables", () => {
    const env = parseEnv(valid);

    expect(env).toMatchObject({
      NODE_ENV: "development",
      DATABASE_POOL_MIN: 0,
      DATABASE_POOL_MAX: 10,
      LOG_LEVEL: "info",
    });
    expect(env.SENTRY_DSN).toBeUndefined();
  });

  it("coerces numbers and treats empty strings as unset", () => {
    const env = parseEnv({
      ...valid,
      DATABASE_POOL_MAX: "25",
      DATABASE_POOL_MIN: "",
      SENTRY_DSN: "",
    });

    expect(env.DATABASE_POOL_MAX).toBe(25);
    expect(env.DATABASE_POOL_MIN).toBe(0);
    expect(env.SENTRY_DSN).toBeUndefined();
  });

  it("names every invalid variable", () => {
    const parse = (): unknown => parseEnv({ DATABASE_POOL_MAX: "many", LOG_LEVEL: "loud" });

    expect(parse).toThrow(EnvError);
    expect(parse).toThrow(/DATABASE_URL/);
    expect(parse).toThrow(/DATABASE_POOL_MAX/);
    expect(parse).toThrow(/LOG_LEVEL/);
  });

  it("rejects a non-PostgreSQL database URL", () => {
    expect(() => parseEnv({ DATABASE_URL: "mysql://u:p@localhost/db" })).toThrow(/DATABASE_URL/);
  });
});
