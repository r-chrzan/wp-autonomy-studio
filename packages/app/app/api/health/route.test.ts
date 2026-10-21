import { beforeEach, describe, expect, it, vi } from "vitest";

const checkConnection = vi.hoisted(() => vi.fn());
const logError = vi.hoisted(() => vi.fn());

vi.mock("next/server", () => ({ connection: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/src/server/container", () => ({
  withRequestScope: <T>(fn: (scope: unknown) => Promise<T>) =>
    fn({ cradle: { orm: { checkConnection } } }),
}));
vi.mock("@/src/server/logger", () => ({ getLogger: () => ({ error: logError }) }));

const { GET } = await import("./route");

describe("GET /api/health", () => {
  beforeEach(() => {
    checkConnection.mockReset();
    logError.mockReset();
  });

  it("returns 200 when the database is reachable", async () => {
    checkConnection.mockResolvedValue({ ok: true });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", db: "up" });
  });

  it("returns 503 when the database check fails", async () => {
    checkConnection.mockResolvedValue({ ok: false });

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "degraded", db: "down" });
  });

  it("returns 503 and logs when the container or database throws", async () => {
    const error = new Error("ECONNREFUSED");
    checkConnection.mockRejectedValue(error);

    const response = await GET();

    expect(response.status).toBe(503);
    expect(logError).toHaveBeenCalledWith({ err: error }, "health check failed");
  });
});
