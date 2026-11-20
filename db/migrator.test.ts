// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  checksum,
  findTransactionControl,
  MigrationError,
  parseMigrationFilename,
  planMigrations,
  readMigrationFiles,
} from "./migrator.js";

const ref = (version: string, sum = "x") => ({ version, name: "n", checksum: sum });

describe("parseMigrationFilename", () => {
  it("parses YYYYMMDDHHMMSS_snake.sql", () => {
    expect(parseMigrationFilename("20261120120000_init.sql")).toEqual({
      version: "20261120120000",
      name: "init",
    });
  });

  it("rejects other names", () => {
    for (const f of [
      "0001_init.sql",
      "20261120120000_Init.sql",
      "20261120120000_init.txt",
      "init.sql",
      "20261120120000_.sql",
      "2026112012000_short.sql",
      "20261120120000_tên.sql",
    ]) {
      expect(parseMigrationFilename(f), f).toBeNull();
    }
  });
});

describe("checksum", () => {
  it("sha256 hex, CRLF equals LF, content change differs", () => {
    expect(checksum("a")).toMatch(/^[0-9a-f]{64}$/);
    expect(checksum("a\r\nb")).toBe(checksum("a\nb"));
    expect(checksum("a\nb")).not.toBe(checksum("a\nc"));
  });
});

describe("planMigrations", () => {
  it("pending in lexical order", () => {
    const plan = planMigrations([ref("3"), ref("1"), ref("2")], []);
    expect(plan.pending.map((m) => m.version)).toEqual(["1", "2", "3"]);
  });

  it("nothing pending when all applied", () => {
    expect(planMigrations([ref("1"), ref("2")], [ref("1"), ref("2")])).toEqual({
      pending: [],
      ahead: [],
    });
  });

  it("checksum differs -> error", () => {
    expect(() => planMigrations([ref("1", "a")], [ref("1", "b")])).toThrow(
      "checksum mismatch for applied migration 1",
    );
  });

  it("applied but missing locally -> error", () => {
    expect(() => planMigrations([ref("2")], [ref("1"), ref("2")])).toThrow(/missing locally/);
  });

  it("pending older than newest applied -> error", () => {
    expect(() => planMigrations([ref("1"), ref("2")], [ref("2")])).toThrow(/older than/);
  });

  it("database ahead -> ahead list, nothing pending", () => {
    expect(planMigrations([ref("1")], [ref("1"), ref("2")])).toEqual({
      pending: [],
      ahead: ["2"],
    });
  });

  it("duplicate local version -> error (exit code 2)", () => {
    try {
      planMigrations([ref("1"), ref("1")], []);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(MigrationError);
      expect((err as MigrationError).exitCode).toBe(2);
      expect((err as Error).message).toMatch(/duplicate migration version 1/);
    }
  });

  it("empty local and empty applied -> nothing pending", () => {
    expect(planMigrations([], [])).toEqual({ pending: [], ahead: [] });
  });
});

describe("findTransactionControl", () => {
  it("flags transaction control", () => {
    const cases: [string, string][] = [
      ["begin;", "begin"],
      ["BEGIN;", "begin"],
      ["begin transaction;", "begin"],
      ["begin work;", "begin"],
      ["start transaction;", "start transaction"],
      ["commit;", "commit"],
      ["commit and chain;", "commit"],
      ["end;", "end"],
      ["abort;", "abort"],
      ["rollback;", "rollback"],
      ["savepoint a;", "savepoint"],
      ["release savepoint a;", "release"],
      ["rollback to savepoint a;", "rollback"],
      ["prepare transaction 'x';", "prepare transaction"],
      ["commit prepared 'x';", "commit"],
      ["select 1; commit", "commit"],
      ["\n  \n  begin;", "begin"],
    ];
    for (const [sql, keyword] of cases) expect(findTransactionControl(sql), sql).toBe(keyword);
  });

  it("ignores non-statements", () => {
    const cases = [
      "-- commit;\nselect 1;",
      "/* begin; */ select 1;",
      "/* a /* commit; */ b */ select 1;",
      "select 'commit;';",
      "select 'it''s; commit';",
      "select E'a\\'; commit';",
      'select 1 as "begin";',
      "create table t (end_date date, begin_at timestamptz);",
      "do $$ begin perform 1; end $$;",
      "do $body$ begin if true then null; end if; end $body$;",
      "create function f() returns int as $$ begin return 1; end; $$ language plpgsql;",
      "insert into t values ('Bắt đầu; kết thúc commit');",
    ];
    for (const sql of cases) expect(findTransactionControl(sql), sql).toBeNull();
  });
});

describe("readMigrationFiles", () => {
  const dirs: string[] = [];
  const makeDir = async (files: Record<string, string>) => {
    const dir = await mkdtemp(path.join(tmpdir(), "simap-mig-"));
    dirs.push(dir);
    for (const [name, content] of Object.entries(files)) {
      await writeFile(path.join(dir, name), content);
    }
    return dir;
  };
  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
  });

  async function exitCode(p: Promise<unknown>) {
    try {
      await p;
    } catch (err) {
      return { code: (err as MigrationError).exitCode, message: (err as Error).message };
    }
    return null;
  }

  it("reads sorted .sql files, ignores README.md and .gitkeep", async () => {
    const dir = await makeDir({
      "20261120120002_b.sql": "select 2;",
      "20261120120001_a.sql": "select 1;",
      "README.md": "x",
      ".gitkeep": "",
    });
    const files = await readMigrationFiles(dir);
    expect(files.map((f) => f.version)).toEqual(["20261120120001", "20261120120002"]);
    expect(files[0].checksum).toBe(checksum("select 1;"));
  });

  it("refuses a bad name with exit code 2", async () => {
    const dir = await makeDir({ "bad-name.sql": "select 1;" });
    expect(await exitCode(readMigrationFiles(dir))).toMatchObject({ code: 2 });
  });

  it("refuses a transaction-control file with exit code 2, message names file and keyword only", async () => {
    const dir = await makeDir({ "20261120120000_x.sql": "select 1;\ncommit;\n" });
    const r = await exitCode(readMigrationFiles(dir));
    expect(r?.code).toBe(2);
    expect(r?.message).toBe(
      "migration 20261120120000_x.sql contains a transaction-control statement (commit)",
    );
  });

  it("missing directory -> exit code 2", async () => {
    const dir = await makeDir({});
    await mkdir(path.join(dir, "sub"));
    expect(await exitCode(readMigrationFiles(path.join(dir, "nope")))).toMatchObject({ code: 2 });
  });
});

describe("real db/migrations files", () => {
  const dir = path.resolve(import.meta.dirname, "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql"));

  it("are well-formed and contain no forbidden statements", () => {
    for (const f of files) {
      expect(parseMigrationFilename(f), f).not.toBeNull();
      const sql = readFileSync(path.join(dir, f), "utf8");
      expect(findTransactionControl(sql), f).toBeNull();
      const lower = sql
        .split("\n")
        .filter((l) => !l.trim().startsWith("--"))
        .join("\n")
        .toLowerCase();
      expect(lower, f).not.toMatch(/concurrently|create\s+extension|\bgrant\b|create\s+role/);
    }
  });
});
