import { afterAll, describe, expect, it } from "vitest";
import { closeOrm, getOrm } from "./orm";

describe("getOrm", () => {
  afterAll(async () => {
    await closeOrm();
  });

  it("connects to PostgreSQL", async () => {
    const orm = await getOrm();

    await expect(orm.checkConnection()).resolves.toMatchObject({ ok: true });
  });

  it("returns the same instance (one pool per process)", async () => {
    const [first, second] = await Promise.all([getOrm(), getOrm()]);

    expect(first).toBe(second);
  });
});
