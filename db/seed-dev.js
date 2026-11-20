// @ts-check
// Dev seed entry: node db/seed-dev.js (pnpm seed:dev). Local database only, fake data, never prints DATABASE_URL.
// Exit codes: 0 ok, 1 runtime failure, 2 configuration error or refused target.
import pg from "pg";
import { assertDevSeedTarget, seedDev } from "./seeder.js";

const databaseUrl = process.env.DATABASE_URL;
try {
  assertDevSeedTarget({ databaseUrl, nodeEnv: process.env.NODE_ENV });
} catch (err) {
  console.error(err instanceof Error ? err.message : "refusing to seed");
  process.exit(2);
}

const client = new pg.Client({ connectionString: databaseUrl });
try {
  await client.connect();
  await client.query("begin");
  await seedDev(client);
  await client.query("commit");
  const r = await client.query("select count(*)::int as n from seats");
  console.log(`seed ok (seats: ${r.rows[0].n})`);
} catch {
  await client.query("rollback").catch(() => {});
  console.error("seed failed");
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
