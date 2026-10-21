import { connection } from "next/server";
import { withRequestScope } from "@/src/server/container";
import { getLogger } from "@/src/server/logger";

/** Liveness + database check. Proves the DI container and ORM are wired. */
export async function GET(): Promise<Response> {
  await connection();

  try {
    const db = await withRequestScope((scope) => scope.cradle.orm.checkConnection());
    return Response.json(
      { status: db.ok ? "ok" : "degraded", db: db.ok ? "up" : "down" },
      { status: db.ok ? 200 : 503 },
    );
  } catch (error) {
    getLogger().error({ err: error }, "health check failed");
    return Response.json({ status: "degraded", db: "down" }, { status: 503 });
  }
}
