import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getOrm = vi.hoisted(() => vi.fn());

vi.mock("@wpas/db", () => ({ getOrm }));

type Globals = { __wpasContainer?: unknown; __wpasLogger?: unknown };

function fakeOrm(): { em: { fork: ReturnType<typeof vi.fn> } } {
  let forks = 0;
  return { em: { fork: vi.fn(() => ({ id: ++forks })) } };
}

describe("app container", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/app");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("LOG_LEVEL", "silent");
    getOrm.mockReset();
    delete (globalThis as Globals).__wpasContainer;
    delete (globalThis as Globals).__wpasLogger;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("registers env, logger and the ORM once per process", async () => {
    const orm = fakeOrm();
    getOrm.mockResolvedValue(orm);
    const { getContainer } = await import("./container");
    const { getLogger } = await import("./logger");

    const [first, second] = await Promise.all([getContainer(), getContainer()]);

    expect(first).toBe(second);
    expect(getOrm).toHaveBeenCalledTimes(1);
    expect(first.cradle.orm).toBe(orm);
    expect(first.cradle.logger).toBe(getLogger());
    expect(first.cradle.env.DATABASE_URL).toBe("postgresql://u:p@localhost:5432/app");
  });

  it("forgets a failed build so the next call retries", async () => {
    getOrm.mockRejectedValueOnce(new Error("db down")).mockResolvedValueOnce(fakeOrm());
    const { getContainer } = await import("./container");

    await expect(getContainer()).rejects.toThrow("db down");
    await expect(getContainer()).resolves.toBeDefined();
  });

  it("gives each request scope its own EntityManager fork", async () => {
    getOrm.mockResolvedValue(fakeOrm());
    const { createRequestScope } = await import("./container");

    const a = await createRequestScope();
    const b = await createRequestScope();

    expect(a.cradle.em).toBe(a.cradle.em);
    expect(a.cradle.em).not.toBe(b.cradle.em);
  });

  it("withRequestScope returns the result and disposes the scope, even on error", async () => {
    getOrm.mockResolvedValue(fakeOrm());
    const { withRequestScope } = await import("./container");
    const disposed: string[] = [];

    const result = await withRequestScope(async (scope) => {
      const dispose = scope.dispose.bind(scope);
      scope.dispose = async () => {
        disposed.push("ok");
        return dispose();
      };
      return Promise.resolve("done");
    });
    await expect(
      withRequestScope((scope) => {
        const dispose = scope.dispose.bind(scope);
        scope.dispose = async () => {
          disposed.push("error");
          return dispose();
        };
        return Promise.reject(new Error("boom"));
      }),
    ).rejects.toThrow("boom");

    expect(result).toBe("done");
    expect(disposed).toEqual(["ok", "error"]);
  });
});
