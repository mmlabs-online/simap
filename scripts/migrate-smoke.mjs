// Scripted smoke test of the migrator against a real Postgres (CI and local `pnpm migrate:smoke`).
// Creates a throwaway database from DATABASE_URL, runs fixture migrations, drops it. Never prints the URL.
import { randomBytes } from "node:crypto";
import { appendFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import pg from "pg";
import { MigrationError, runMigrations } from "../db/migrator.js";

const base = process.env.DATABASE_URL;
if (!base) {
  console.error("DATABASE_URL is not set");
  process.exit(2);
}

const dbName = `simap_smoke_${randomBytes(6).toString("hex")}`;
const withDb = (/** @type {string} */ name) => {
  const u = new URL(base);
  u.pathname = `/${name}`;
  return u.toString();
};

const tmpDirs = [];
async function fixtureDir(/** @type {Record<string, string>} */ files) {
  const dir = await mkdtemp(path.join(tmpdir(), "simap-smoke-"));
  tmpDirs.push(dir);
  for (const [name, sql] of Object.entries(files)) await writeFile(path.join(dir, name), sql);
  return dir;
}

let failed = false;
function check(/** @type {string} */ step, /** @type {boolean} */ ok) {
  console.log(`${ok ? "pass" : "FAIL"}: ${step}`);
  if (!ok) failed = true;
}

const admin = new pg.Client({ connectionString: base });
await admin.connect();
await admin.query(`create database ${dbName}`);

try {
  const url = withDb(dbName);
  const count = async () => {
    const c = new pg.Client({ connectionString: url });
    await c.connect();
    try {
      const r = await c.query("select count(*)::int as n from schema_migrations");
      const t = await c.query("select to_regclass('smoke_c') as c");
      return { n: r.rows[0].n, smokeC: t.rows[0].c };
    } finally {
      await c.end();
    }
  };
  const run = async (/** @type {string} */ dir) => {
    /** @type {string[]} */
    const lines = [];
    await runMigrations({ connectionString: url, dir, log: (l) => lines.push(l) });
    return lines;
  };

  const dir = await fixtureDir({
    "20261120120001_a.sql": "create table smoke_a (id int primary key);\n",
    "20261120120002_b.sql": "insert into smoke_a values (1);\n",
  });

  const first = await run(dir);
  check(
    "1 applies both files in order",
    first.length === 2 &&
      first[0].includes("20261120120001_a") &&
      first[1].includes("20261120120002_b"),
  );
  check("1 records 2 rows", (await count()).n === 2);

  const second = await run(dir);
  check("2 second run is up to date", second.length === 1 && second[0] === "up to date");

  await appendFile(path.join(dir, "20261120120001_a.sql"), "-- edited\n");
  await writeFile(path.join(dir, "20261120120003_c.sql"), "create table smoke_c (id int);\n");
  let mismatch = false;
  try {
    await run(dir);
  } catch (err) {
    mismatch =
      err instanceof MigrationError && /checksum mismatch for applied migration/.test(err.message);
  }
  const after = await count();
  check("3 edited migration fails with checksum mismatch", mismatch);
  check("3 nothing changed", after.n === 2 && after.smokeC === null);

  for (const [step, files] of [
    ["4 transaction-control file refused", { "20261120120009_x.sql": "commit;\n" }],
    ["4 bad file name refused", { "bad-name.sql": "select 1;\n" }],
  ]) {
    let code = 0;
    try {
      await run(await fixtureDir(files));
    } catch (err) {
      code = err instanceof MigrationError ? err.exitCode : -1;
    }
    check(step, code === 2);
  }
  check("4 nothing recorded by refusals", (await count()).n === 2);
} finally {
  await admin.query(`drop database if exists ${dbName} with (force)`).catch(() => {});
  await admin.end().catch(() => {});
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
}

if (failed) process.exit(1);
console.log("migrate smoke ok");
