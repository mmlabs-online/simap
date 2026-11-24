import { describe, expect, it } from "vitest";
import { FOLD_FROM, FOLD_TO } from "@/lib/search/fold";
import type { OrgScope } from "@/server/http/org-scope";
import type { SearchFilter } from "@/lib/validate/search-query";
import { search } from "./search";

const scope = { orgId: "11111111-1111-4111-8111-111111111111" } as OrgScope;

function fakeDb() {
  const calls: [string, unknown[]][] = [];
  const query = async (text: string, values: unknown[] = []) => {
    calls.push([text.replace(/\s+/g, " ").trim(), values]);
    return { rows: [] };
  };
  return { db: { query, connect: async () => ({ query, release: () => {} }) }, calls };
}
const reads = (calls: [string, unknown[]][]) => calls.filter(([s]) => s.startsWith("select"));

const filter = (o: Partial<SearchFilter> = {}): SearchFilter => ({
  q: "Nguyễn 50%_",
  folded: "nguyen 50%_",
  kind: "all",
  limit: 3,
  ...o,
});

describe("search", () => {
  it("user text only in values: pattern %<escaped fold>%, limit+1; SQL contains translate constants and org_id = $1 on every table", async () => {
    const t = fakeDb();
    await search(t.db, scope, filter());
    const r = reads(t.calls);
    expect(r).toHaveLength(3);
    for (const [sql, values] of r) {
      expect(sql).toContain(`translate(`);
      expect(sql).toContain(`'${FOLD_FROM}', '${FOLD_TO}'`);
      expect(sql).not.toMatch(/nguyen|Nguy|50%/);
      expect(values[0]).toBe(scope.orgId);
      expect(values[1]).toBe("%nguyen 50\\%\\_%");
      expect(values.at(-1)).toBe(4);
    }
    const [seatSql] = r[0]!;
    expect(seatSql).toMatch(/s\.org_id = \$1/);
    expect(seatSql).toMatch(/r\.org_id = s\.org_id/);
    const [devSql] = r[1]!;
    for (const j of ["m.org_id = d.org_id", "s.org_id = d.org_id", "r.org_id = s.org_id"]) {
      expect(devSql).toContain(j);
    }
  });

  it("kind=seat runs only the seat query; others null", async () => {
    const t = fakeDb();
    const res = await search(t.db, scope, filter({ kind: "seat" }));
    expect(reads(t.calls)).toHaveLength(1);
    expect(res).toEqual({ seats: { items: [], nextCursor: null }, devices: null, members: null });
  });

  it("MAC-like query adds a bound compact mac pattern; cursor adds a keyset", async () => {
    const t = fakeDb();
    const id = "33333333-3333-4333-8333-333333333333";
    await search(
      t.db,
      scope,
      filter({
        q: "AA-BB",
        folded: "aa-bb",
        kind: "device",
        cursor: { t: "device", k: "may in", id },
      }),
    );
    const [sql, values] = reads(t.calls)[0]!;
    expect(sql).toContain("replace(d.mac, ':', '') like $3");
    expect(sql).toContain("(lower(d.name), d.id) > ($4::text, $5::uuid)");
    expect(values).toEqual([scope.orgId, "%aa-bb%", "%aabb%", "may in", id, 4]);
  });
});
