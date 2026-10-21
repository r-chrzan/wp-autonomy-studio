import path from "node:path";
import { Migrator } from "@mikro-orm/migrations";
import { describe, expect, it } from "vitest";
import { migrationsPath, withMigrator } from "./migrator";

describe("withMigrator", () => {
  it("points at the committed migrations folder by absolute path", () => {
    expect(path.isAbsolute(migrationsPath)).toBe(true);
    expect(migrationsPath).toBe(path.join(import.meta.dirname, "migrations"));
  });

  it("adds the Migrator extension and keeps the given options", () => {
    const config = withMigrator({ debug: true });

    expect(config.debug).toBe(true);
    expect(config.extensions).toEqual([Migrator]);
    expect(config.migrations).toEqual({
      path: migrationsPath,
      pathTs: migrationsPath,
      snapshot: true,
    });
  });

  it("works without options", () => {
    expect(withMigrator().extensions).toEqual([Migrator]);
  });
});
