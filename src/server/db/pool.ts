import "server-only";
import pg from "pg";

type LogSink = (entry: Record<string, unknown>) => void;

const logEntry: LogSink = (entry) => console.error(JSON.stringify(entry));

declare global {
  var __simapPool: pg.Pool | undefined;
}

export function createPool(connectionString: string, log: LogSink = () => {}): pg.Pool {
  const pool = new pg.Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 30000,
    statement_timeout: 5000,
    application_name: "simap-api",
    // date (1082) stays 'YYYY-MM-DD'; per-pool so the global parsers are untouched.
    types: {
      getTypeParser: ((oid: number, fmt?: "text" | "binary") =>
        oid === 1082
          ? (v: string) => v
          : pg.types.getTypeParser(oid as never, fmt as never)) as never,
    },
  });
  pool.on("error", (err) => log({ event: "pool_error", code: (err as { code?: string }).code }));
  return pool;
}

/** Lazy pool from DATABASE_URL; null when it is unset (the app still starts). */
export function getPool(): pg.Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  globalThis.__simapPool ??= createPool(url, logEntry);
  return globalThis.__simapPool;
}

export async function ping(
  pool: { query(sql: string): Promise<unknown> },
  timeoutMs = 2000,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
  });
  try {
    await Promise.race([pool.query("select 1"), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
