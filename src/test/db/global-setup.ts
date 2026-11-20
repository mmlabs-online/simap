import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import type { TestProject } from "vitest/node";
import { runMigrations } from "../../../db/migrator.js";
import { assertDevSeedTarget } from "../../../db/seeder.js";

declare module "vitest" {
  export interface ProvidedContext {
    simapTestDbUrl: string;
  }
}

/** One throwaway database per run: guard, create, migrate with the real migrator, drop at teardown. Never logs the URL. */
export default async function setup(project: TestProject) {
  const base = process.env.DATABASE_URL;
  assertDevSeedTarget({ databaseUrl: base, nodeEnv: process.env.NODE_ENV });

  const dbName = `simap_test_${randomBytes(6).toString("hex")}`;
  const u = new URL(base!);
  u.pathname = `/${dbName}`;
  const url = u.toString();
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../db/migrations");

  const admin = new pg.Client({ connectionString: base });
  await admin.connect();
  try {
    await admin.query(`create database ${dbName}`);
    await runMigrations({ connectionString: url, dir, log: () => {} });
  } catch (err) {
    await admin.query(`drop database if exists ${dbName} with (force)`).catch(() => {});
    await admin.end();
    throw err;
  }
  project.provide("simapTestDbUrl", url);

  return async () => {
    try {
      await admin.query(`drop database if exists ${dbName} with (force)`);
    } finally {
      await admin.end();
    }
  };
}
