import { inject } from "vitest";

// Runs before each integration test file, so `getEnv()` sees the container's database.
process.env.DATABASE_URL = inject("databaseUrl");
