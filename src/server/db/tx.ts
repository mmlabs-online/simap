import "server-only";

export type TxClient = {
  query(text: string, values?: unknown[]): Promise<{ rows: any[] }>;
  release(): void;
};
export type TxPool = { connect(): Promise<TxClient> };

/** One transaction: BEGIN, fn, COMMIT; ROLLBACK and rethrow on error; the client is always released. */
export async function withTx<T>(pool: TxPool, fn: (client: TxClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (err) {
    try {
      await client.query("rollback");
    } catch {
      // the original error wins
    }
    throw err;
  } finally {
    client.release();
  }
}
