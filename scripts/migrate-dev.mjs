// `pnpm migrate`: local-only wrapper (SIM-029, D56). Refuses a production or non-local target (exit 2) before the
// real entry runs. The image entry `node db/migrate.js` is separate and unguarded on purpose.
import { assertDevSeedTarget } from "../db/seeder.js";

if (process.env.DATABASE_URL) {
  try {
    assertDevSeedTarget({ databaseUrl: process.env.DATABASE_URL, nodeEnv: process.env.NODE_ENV });
  } catch (e) {
    console.error(`migrate refused: ${e instanceof Error ? e.message : "invalid target"}`);
    process.exit(2);
  }
}
await import("../db/migrate.js");
