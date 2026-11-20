// `pnpm test:db`: runs the DB integration tests (vitest.db.config.ts) against a throwaway database made from
// DATABASE_URL. Refuses a non-local DATABASE_URL and NODE_ENV=production (exit 2) before Vitest starts or anything
// connects. Never prints the URL.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { assertDevSeedTarget } from "../db/seeder.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("test:db refused: DATABASE_URL is not set");
  process.exit(2);
}
try {
  assertDevSeedTarget({ databaseUrl, nodeEnv: process.env.NODE_ENV });
} catch (err) {
  console.error(`test:db refused: ${err instanceof Error ? err.message : "bad target"}`);
  process.exit(2);
}

const vitestBin = createRequire(import.meta.url).resolve("vitest/vitest.mjs");
const r = spawnSync(process.execPath, [vitestBin, "run", "-c", "vitest.db.config.ts"], {
  stdio: "inherit",
});
process.exit(r.status ?? 1);
