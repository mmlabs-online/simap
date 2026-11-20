import { describe, expect, it } from "vitest";
import { withTx } from "./tx";

function fake() {
  const log: string[] = [];
  const client = {
    query: async (t: string) => {
      log.push(t);
      return { rows: [] };
    },
    release: () => {
      log.push("release");
    },
  };
  return { log, pool: { connect: async () => client } };
}

describe("withTx", () => {
  it("COMMIT on success, then release", async () => {
    const { pool, log } = fake();
    expect(await withTx(pool, async (c) => (await c.query("work"), 7))).toBe(7);
    expect(log).toEqual(["begin", "work", "commit", "release"]);
  });

  it("ROLLBACK and rethrow on error; the client is still released", async () => {
    const { pool, log } = fake();
    await expect(
      withTx(pool, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(log).toEqual(["begin", "rollback", "release"]);
  });
});
