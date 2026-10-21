import { connection } from "next/server";
import { createRequestScope } from "@/src/server/container";

/** Liveness + database check. Proves the DI container and ORM are wired. */
export async function GET() {
  await connection();

  try {
    const scope = await createRequestScope();
    const db = await scope.cradle.orm.checkConnection();
    await scope.dispose();
    return Response.json(
      { status: db.ok ? "ok" : "degraded", db: db.ok ? "up" : "down" },
      { status: db.ok ? 200 : 503 },
    );
  } catch (error) {
    console.error("[health] database check failed", error);
    return Response.json({ status: "degraded", db: "down" }, { status: 503 });
  }
}
