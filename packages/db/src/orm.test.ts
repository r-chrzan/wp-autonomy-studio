import type * as Postgres from "@mikro-orm/postgresql";
import type * as OrmModule from "./orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const init = vi.hoisted(() => vi.fn());

vi.mock("@mikro-orm/postgresql", async (importOriginal) => ({
  ...(await importOriginal<typeof Postgres>()),
  MikroORM: { init },
}));

type FakeOrm = { connect: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };

function fakeOrm(): FakeOrm {
  return { connect: vi.fn().mockResolvedValue(undefined), close: vi.fn() };
}

async function loadOrm(): Promise<typeof OrmModule> {
  return import("./orm");
}

describe("getOrm", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/app");
    init.mockReset();
  });

  afterEach(async () => {
    await (await loadOrm()).closeOrm();
    vi.unstubAllEnvs();
  });

  it("initialises and connects once, then reuses the instance", async () => {
    const orm = fakeOrm();
    init.mockResolvedValue(orm);
    const { getOrm } = await loadOrm();

    const [first, second] = await Promise.all([getOrm(), getOrm()]);

    expect(first).toBe(orm);
    expect(second).toBe(orm);
    expect(init).toHaveBeenCalledTimes(1);
    expect(orm.connect).toHaveBeenCalledTimes(1);
  });

  it("forgets a failed initialisation so the next call retries", async () => {
    const orm = fakeOrm();
    init.mockRejectedValueOnce(new Error("db down")).mockResolvedValueOnce(orm);
    const { getOrm } = await loadOrm();

    await expect(getOrm()).rejects.toThrow("db down");
    await expect(getOrm()).resolves.toBe(orm);
    expect(init).toHaveBeenCalledTimes(2);
  });
});

describe("closeOrm", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/app");
  });

  it("closes the pool and lets the next getOrm() start fresh", async () => {
    const first = fakeOrm();
    const second = fakeOrm();
    init.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const { closeOrm, getOrm } = await loadOrm();

    await getOrm();
    await closeOrm();

    expect(first.close).toHaveBeenCalledTimes(1);
    await expect(getOrm()).resolves.toBe(second);
    await closeOrm();
  });

  it("does nothing when no ORM was created", async () => {
    const { closeOrm } = await loadOrm();

    await expect(closeOrm()).resolves.toBeUndefined();
  });
});
