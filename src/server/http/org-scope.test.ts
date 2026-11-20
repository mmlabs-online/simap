import { describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import * as mod from "./org-scope";
import { orgQuery, type OrgScope } from "./org-scope";

const ORG = "22222222-2222-4222-8222-222222222222";
const scope = { orgId: ORG } as OrgScope;

describe("org-scope exports", () => {
  it("exports no OrgScope constructor", () => {
    expect(Object.keys(mod).sort()).toEqual(["orgQuery"]);
    // @ts-expect-error orgScopeOf was removed
    expect(mod.orgScopeOf).toBeUndefined();
    // @ts-expect-error a plain object is not an OrgScope
    const forged: OrgScope = { orgId: ORG };
    expect(forged.orgId).toBe(ORG);
  });

  it("OrgScope is cast only in with-auth.ts and tests", () => {
    // Text heuristic, not a proof: a deliberate cast is also visible in review.
    const src = fileURLToPath(new URL("../../", import.meta.url));
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) return walk(p);
        return /\.tsx?$/.test(n) && !/\.test\./.test(n) ? [p] : [];
      });
    const bad = walk(src)
      .map((p) => relative(src, p).replaceAll("\\", "/"))
      .filter((rel) => rel !== "server/http/with-auth.ts")
      .filter((rel) =>
        /\bas\s+(unknown\s+as\s+)?OrgScope\b|<OrgScope>/.test(readFileSync(join(src, rel), "utf8")),
      );
    expect(bad).toEqual([]);
  });
});

describe("orgQuery", () => {
  it("prepends scope.orgId as $1 and passes the remaining values shifted", async () => {
    const query = vi.fn(async (_t: string, _v: unknown[]) => ({ rows: [{ id: 1 }] }));
    const r = await orgQuery(
      { query },
      scope,
      "select id from room where org_id = $1 and name = $2",
      ["A1"],
    );
    expect(query).toHaveBeenCalledWith("select id from room where org_id = $1 and name = $2", [
      ORG,
      "A1",
    ]);
    expect(r.rows).toEqual([{ id: 1 }]);
  });

  it("works without extra values", async () => {
    const query = vi.fn(async (_t: string, _v: unknown[]) => ({ rows: [] }));
    await orgQuery({ query }, scope, "select 1 from seat where org_id=$1");
    expect(query).toHaveBeenCalledWith("select 1 from seat where org_id=$1", [ORG]);
  });

  it("throws before querying when SQL lacks org_id = $1 (case/whitespace tolerant)", () => {
    const query = vi.fn(async (_t: string, _v: unknown[]) => ({ rows: [] }));
    for (const sql of [
      "select * from room",
      "select * from room where org_id = $2",
      "select * from room where id = $1",
      "select * from room where org_id = $10",
    ]) {
      expect(() => orgQuery({ query }, scope, sql)).toThrow(/org_id = \$1/);
    }
    expect(query).not.toHaveBeenCalled();
    expect(() =>
      orgQuery({ query }, scope, "SELECT * FROM room WHERE ORG_ID\n  =  $1"),
    ).not.toThrow();
  });
});
