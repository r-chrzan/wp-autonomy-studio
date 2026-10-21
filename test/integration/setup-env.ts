import { inject } from "vitest";

// Runs before each integration test file, so `getEnv()` sees the ephemeral database.
process.env.DATABASE_URL = inject("databaseUrl");
