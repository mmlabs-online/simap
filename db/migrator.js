// @ts-check
// Migration runner (ported from tudocuatui). Plain Node ESM: no Next.js, no `@/` imports, no `server-only`.
// Never logs the connection string, SQL text, config or whole error objects.
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const LOCK_KEY = "7410512013";
const FILENAME_RE = /^(\d{14})_([a-z0-9_]+)\.sql$/;

export class MigrationError extends Error {
  /**
   * @param {string} message
   * @param {number} [exitCode] 1 = runtime failure, 2 = configuration error
   * @param {string} [code] database error code, if any
   */
  constructor(message, exitCode = 1, code) {
    super(message);
    this.name = "MigrationError";
    this.exitCode = exitCode;
    this.code = code;
  }
}

/** @param {string} filename */
export function parseMigrationFilename(filename) {
  const m = FILENAME_RE.exec(filename);
  return m ? { version: m[1], name: m[2] } : null;
}

/** @param {string | Buffer} content sha256 hex, CRLF normalised to LF */
export function checksum(content) {
  const text = content.toString("utf8").replace(/\r\n/g, "\n");
  return createHash("sha256").update(text).digest("hex");
}

/**
 * @typedef {{ version: string, name: string, checksum: string }} MigrationRef
 * @param {MigrationRef[]} local
 * @param {MigrationRef[]} applied
 * @returns {{ pending: MigrationRef[], ahead: string[] }}
 */
export function planMigrations(local, applied) {
  const sortedLocal = [...local].sort((a, b) => a.version.localeCompare(b.version));
  const seen = new Set();
  for (const m of sortedLocal) {
    if (seen.has(m.version)) {
      throw new MigrationError(`duplicate migration version ${m.version}`, 2);
    }
    seen.add(m.version);
  }
  const newestLocal = sortedLocal.length ? sortedLocal[sortedLocal.length - 1].version : "";
  const localByVersion = new Map(sortedLocal.map((m) => [m.version, m]));
  const appliedVersions = new Set(applied.map((a) => a.version));

  const ahead = [];
  let newestAppliedKnown = "";
  for (const a of [...applied].sort((x, y) => x.version.localeCompare(y.version))) {
    const l = localByVersion.get(a.version);
    if (!l) {
      if (a.version > newestLocal) ahead.push(a.version);
      else throw new MigrationError(`applied migration ${a.version} is missing locally`);
      continue;
    }
    if (l.checksum !== a.checksum) {
      throw new MigrationError(`checksum mismatch for applied migration ${a.version}`);
    }
    newestAppliedKnown = a.version;
  }

  const pending = sortedLocal.filter((m) => !appliedVersions.has(m.version));
  for (const m of pending) {
    if (m.version < newestAppliedKnown) {
      throw new MigrationError(`migration ${m.version} is older than the newest applied one`);
    }
  }
  return { pending, ahead };
}

const CONTROL_PREFIXES = [
  "begin",
  "start transaction",
  "commit",
  "end",
  "abort",
  "rollback",
  "savepoint",
  "release",
  "prepare transaction",
];

/**
 * Returns the transaction-control keyword that starts a statement, or null.
 * Comments, quoted strings, quoted identifiers and dollar-quoted bodies are skipped, so
 * `do $$ begin ... end $$;` is allowed.
 * @param {string} sql
 * @returns {string | null}
 */
export function findTransactionControl(sql) {
  /** @type {string[]} */
  const statements = [];
  let cur = "";
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const c = sql[i];
    const next = sql[i + 1];
    if (c === "-" && next === "-") {
      while (i < n && sql[i] !== "\n") i++;
      cur += " ";
    } else if (c === "/" && next === "*") {
      let depth = 1;
      i += 2;
      while (i < n && depth > 0) {
        if (sql[i] === "/" && sql[i + 1] === "*") {
          depth++;
          i += 2;
        } else if (sql[i] === "*" && sql[i + 1] === "/") {
          depth--;
          i += 2;
        } else i++;
      }
      cur += " ";
    } else if (c === "'" || c === '"') {
      const escape = c === "'" && /[eE]/.test(sql[i - 1] ?? "") && !/\w/.test(sql[i - 2] ?? " ");
      i++;
      while (i < n) {
        if (escape && sql[i] === "\\") i += 2;
        else if (sql[i] === c && sql[i + 1] === c) i += 2;
        else if (sql[i] === c) break;
        else i++;
      }
      i++;
      cur += " x ";
    } else if (c === "$") {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
      const prev = sql[i - 1] ?? "";
      if (m && !/[A-Za-z0-9_]/.test(prev)) {
        const end = sql.indexOf(m[0], i + m[0].length);
        i = end === -1 ? n : end + m[0].length;
        cur += " x ";
      } else {
        cur += c;
        i++;
      }
    } else if (c === ";") {
      statements.push(cur);
      cur = "";
      i++;
    } else {
      cur += c;
      i++;
    }
  }
  statements.push(cur);

  for (const s of statements) {
    const words = s.trim().toLowerCase().split(/\s+/).join(" ");
    if (!words) continue;
    for (const k of CONTROL_PREFIXES) {
      if (words === k || words.startsWith(`${k} `)) return k;
    }
  }
  return null;
}

/** @param {string} dir */
export async function readMigrationFiles(dir) {
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    throw new MigrationError("migrations directory not found", 2);
  }
  const files = [];
  for (const f of entries.filter((e) => e.endsWith(".sql")).sort()) {
    const parsed = parseMigrationFilename(f);
    if (!parsed) throw new MigrationError(`invalid migration file name: ${f}`, 2);
    const sql = await readFile(path.join(dir, f), "utf8");
    const keyword = findTransactionControl(sql);
    if (keyword) {
      throw new MigrationError(
        `migration ${f} contains a transaction-control statement (${keyword})`,
        2,
      );
    }
    files.push({ ...parsed, sql, checksum: checksum(sql) });
  }
  return files;
}

/** @param {unknown} err */
const errCode = (err) =>
  err && typeof err === "object" && "code" in err && typeof err.code === "string"
    ? err.code
    : undefined;

/** @param {number} ms */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {{ connectionString: string, dir: string, log?: (line: string) => void, lockWaitMs?: number }} opts
 */
export async function runMigrations({ connectionString, dir, log = () => {}, lockWaitMs = 30000 }) {
  const files = await readMigrationFiles(dir);

  /** @type {import("pg").Client} */
  let client;
  try {
    client = new pg.Client({
      connectionString,
      connectionTimeoutMillis: 5000,
      application_name: "simap-migrate",
    });
    // Without a listener a dropped connection would throw an unhandled error event.
    client.on("error", () => {});
    await client.connect();
  } catch (err) {
    throw new MigrationError(
      "cannot connect to the database (DATABASE_URL not printed)",
      1,
      errCode(err),
    );
  }

  let locked = false;
  try {
    const deadline = Date.now() + lockWaitMs;
    for (;;) {
      const r = await client.query(`select pg_try_advisory_lock(${LOCK_KEY}) as ok`);
      if (r.rows[0].ok) {
        locked = true;
        break;
      }
      if (Date.now() >= deadline) throw new MigrationError("another migration is running");
      await sleep(Math.min(500, Math.max(10, lockWaitMs / 4)));
    }

    await client.query(
      `create table if not exists schema_migrations (
         version text primary key,
         name text not null,
         checksum text not null,
         applied_at timestamptz not null default now()
       )`,
    );
    const { rows } = await client.query("select version, name, checksum from schema_migrations");
    const { pending, ahead } = planMigrations(files, rows);

    if (ahead.length) {
      log(`warning: database is ahead of this image (${ahead.join(", ")}); nothing applied`);
      return;
    }
    if (!pending.length) {
      log("up to date");
      return;
    }

    for (const m of pending) {
      const file = files.find((f) => f.version === m.version);
      if (!file) continue;
      const started = Date.now();
      try {
        await client.query("begin");
        await client.query("set local lock_timeout = '10s'");
        await client.query("set local statement_timeout = '5min'");
        await client.query("set local simap.migrating = 'on'");
        await client.query(file.sql);
        // A transaction-control statement in the file would have dropped the transaction-local setting.
        const guard = await client.query(
          "select current_setting('simap.migrating', true) = 'on' as ok",
        );
        if (!guard.rows[0].ok) throw new Error("migration ended the transaction itself");
        await client.query(
          "insert into schema_migrations (version, name, checksum) values ($1, $2, $3)",
          [file.version, file.name, file.checksum],
        );
        await client.query("commit");
      } catch (err) {
        await client.query("rollback").catch(() => {});
        // Only the message is printed, never the PG `detail` (it can carry row values).
        const msg = err instanceof Error ? err.message : "unknown error";
        throw new MigrationError(`migration ${file.version} failed: ${msg}`, 1, errCode(err));
      }
      log(`applied ${file.version}_${file.name} (${Date.now() - started} ms)`);
    }
  } finally {
    if (locked) await client.query(`select pg_advisory_unlock(${LOCK_KEY})`).catch(() => {});
    await client.end().catch(() => {});
  }
}
