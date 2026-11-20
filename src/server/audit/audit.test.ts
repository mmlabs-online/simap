import { describe, expect, it } from "vitest";
import { decodeCursor } from "@/lib/audit/cursor";
import type { OrgScope } from "@/server/http/org-scope";
import { listAudit, listAuditFacets } from "./audit";

const ORG = "11111111-1111-4111-8111-111111111111";
const scope = { orgId: ORG } as OrgScope;
const ACTOR = "22222222-2222-4222-8222-222222222222";
const ID = "33333333-3333-4333-8333-333333333333";

type Call = [string, unknown[]];
function fakeDb(rows: unknown[] | ((n: number) => unknown[])) {
  const calls: Call[] = [];
  const query = async (text: string, values: unknown[] = []) => {
    calls.push([text.replace(/\s+/g, " ").trim(), values]);
    return { rows: typeof rows === "function" ? rows(calls.length) : rows };
  };
  return { db: { query }, calls };
}

const row = (i: number, o: Record<string, unknown> = {}) => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
  actor_sub: ACTOR,
  display_name: "Nguyễn Văn Ạ",
  action: "room.create",
  entity: "room",
  entity_id: ID,
  meta: { code: "A1" },
  at: `2026-11-20T08:46:0${i % 10}.123456Z`,
  ...o,
});

describe("listAudit", () => {
  it("unfiltered: org_id = $1 bound to scope.orgId, order by a.created_at desc, a.id desc, limit = limit+1", async () => {
    const { db, calls } = fakeDb([]);
    await listAudit(db, scope, { limit: 50 });
    const [sql, values] = calls[0]!;
    expect(sql).toContain(
      "where a.org_id = $1 order by a.created_at desc, a.id desc limit $2::int",
    );
    expect(values).toEqual([ORG, 51]);
  });

  it("query is bound to scope.orgId as $1 and the members join also matches org_id", async () => {
    const { db, calls } = fakeDb([]);
    await listAudit(db, scope, { limit: 10 });
    expect(calls[0]![0]).toContain(
      "left join members m on m.org_id = a.org_id and m.sub = a.actor_sub",
    );
    expect(calls[0]![1][0]).toBe(ORG);
  });

  it("actor + entity + from + to combine with AND, values bound not interpolated", async () => {
    const { db, calls } = fakeDb([]);
    await listAudit(db, scope, {
      actor: ACTOR,
      entity: "room",
      from: "2026-11-01T00:00:00.000Z",
      to: "2026-11-20T00:00:00.000Z",
      limit: 5,
    });
    const [sql, values] = calls[0]!;
    expect(sql).toContain(
      "a.org_id = $1 and a.actor_sub = $2::uuid and a.entity = $3::text and a.created_at >= $4::timestamptz and a.created_at < $5::timestamptz",
    );
    expect(sql).not.toContain(ACTOR);
    expect(sql).not.toContain("room'");
    expect(values).toEqual([
      ORG,
      ACTOR,
      "room",
      "2026-11-01T00:00:00.000Z",
      "2026-11-20T00:00:00.000Z",
      6,
    ]);
  });

  it("cursor adds (a.created_at, a.id) < keyset predicate", async () => {
    const { db, calls } = fakeDb([]);
    await listAudit(db, scope, { limit: 5, cursor: { at: "2026-11-20T08:46:02.123456Z", id: ID } });
    const [sql, values] = calls[0]!;
    expect(sql).toContain("(a.created_at, a.id) < ($2::timestamptz, $3::uuid)");
    expect(values).toEqual([ORG, "2026-11-20T08:46:02.123456Z", ID, 6]);
  });

  it("limit+1 rows -> nextCursor from the last kept row, page trimmed", async () => {
    const rows = [row(3), row(2), row(1)];
    const { db } = fakeDb(rows);
    const page = await listAudit(db, scope, { limit: 2 });
    expect(page.items.map((i) => i.id)).toEqual([rows[0]!.id, rows[1]!.id]);
    expect(decodeCursor(page.nextCursor!)).toEqual({ at: rows[1]!.at, id: rows[1]!.id });
  });

  it("last page has nextCursor null", async () => {
    const { db } = fakeDb([row(2), row(1)]);
    expect((await listAudit(db, scope, { limit: 2 })).nextCursor).toBeNull();
    const empty = await listAudit(fakeDb([]).db, scope, { limit: 2 });
    expect(empty).toEqual({ items: [], nextCursor: null });
  });

  it("missing member -> displayName null; name with diacritics passes through", async () => {
    const { db } = fakeDb([row(2, { display_name: null }), row(1)]);
    const page = await listAudit(db, scope, { limit: 5 });
    expect(page.items[0]!.actor).toEqual({ sub: ACTOR, displayName: null });
    expect(page.items[1]!.actor.displayName).toBe("Nguyễn Văn Ạ");
  });

  it("DTO maps only id, actor, action, entity, entityId, meta, at; null meta stays null", async () => {
    const { db } = fakeDb([row(1, { org_id: ORG, meta: null, entity_id: null })]);
    const [item] = (await listAudit(db, scope, { limit: 5 })).items;
    expect(Object.keys(item!).sort()).toEqual(
      ["action", "actor", "at", "entity", "entityId", "id", "meta"].sort(),
    );
    expect(item!.meta).toBeNull();
    expect(item!.entityId).toBeNull();
  });
});

describe("listAuditFacets", () => {
  it("queries scoped by org_id = $1, bounded by limit", async () => {
    const { db, calls } = fakeDb((n) =>
      n === 1 ? [{ actor_sub: ACTOR, display_name: null }] : [{ entity: "room" }],
    );
    const f = await listAuditFacets(db, scope);
    expect(calls).toHaveLength(2);
    for (const [sql, values] of calls) {
      expect(sql).toContain("a.org_id = $1");
      expect(sql).toMatch(/limit \d+$/);
      expect(values).toEqual([ORG]);
    }
    expect(f).toEqual({ actors: [{ sub: ACTOR, displayName: null }], entities: ["room"] });
  });
});
