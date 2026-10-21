import { describe, expect, it } from "vitest";
import * as db from "./index";

describe("@wpas/db public API", () => {
  it("exports the ORM lifecycle, config and entity registry", () => {
    expect(db.getOrm).toBeTypeOf("function");
    expect(db.closeOrm).toBeTypeOf("function");
    expect(db.createOrmConfig).toBeTypeOf("function");
    expect(db.entities).toEqual([]);
  });
});
