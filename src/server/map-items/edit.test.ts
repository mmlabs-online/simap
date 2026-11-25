import { describe, expect, it } from "vitest";
import type { OrgScope } from "@/server/http/org-scope";
import { resetMapItem, setMapItemArt, updateMapItem } from "./edit";

const scope = { orgId: "11111111-1111-4111-8111-111111111111" } as unknown as OrgScope;
const SUB = "22222222-2222-4222-8222-222222222222";

function row(over: Record<string, unknown> = {}) {
  const r: Record<string, unknown> = {
    builtin_key: "plant.large",
    name: "plant large",
    group_name: "plant",
    w: 1,
    h: 1,
    hidden: false,
  };
  for (const d of ["n", "e", "s", "w"]) {
    r[`art_${d}_sprite`] = null;
    r[`art_${d}_has_image`] = false;
    r[`art_${d}_image_version`] = 0;
    r[`art_${d}_drive_file_id`] = null;
  }
  return { ...r, ...over };
}

/** A recording pool: `current` answers the lock select, `inUse` the count. */
function fake(current: Record<string, unknown> | null, inUse = 0) {
  const sql: string[] = [];
  const client = {
    release() {},
    async query(text: string) {
      const t = text.replace(/\s+/g, " ").trim();
      sql.push(t);
      if (/^select .* from map_items/.test(t)) return { rows: current ? [current] : [] };
      if (/^select count/.test(t)) return { rows: [{ n: inUse }] };
      if (/^update map_items/.test(t)) return { rows: [{ ...current }] };
      return { rows: [] };
    },
  };
  return { pool: { connect: async () => client }, sql };
}

describe("map item edits (mocked db)", () => {
  it('rename/group/hide/art lock the row "for no key update"; a size change and a size-changing reset lock "for update"', async () => {
    let f = fake(row());
    await updateMapItem(f.pool, scope, SUB, "plant.large", { name: "Cây" });
    expect(f.sql[1]).toMatch(/for no key update$/);
    f = fake(row());
    await updateMapItem(f.pool, scope, SUB, "plant.large", { hidden: true });
    expect(f.sql[1]).toMatch(/for no key update$/);
    f = fake(row());
    await setMapItemArt(f.pool, scope, SUB, "plant.large", "s", "plant.small");
    expect(f.sql[1]).toMatch(/for no key update$/);
    f = fake(row());
    await updateMapItem(f.pool, scope, SUB, "plant.large", { w: 2 });
    expect(f.sql[1]).toMatch(/for update$/);
    f = fake(row({ w: 2 }));
    await resetMapItem(f.pool, scope, SUB, "plant.large");
    expect(f.sql[1]).toMatch(/for update$/);
    f = fake(row({ builtin_key: "chair.office", name: "x" }));
    await resetMapItem(f.pool, scope, SUB, "chair.office");
    expect(f.sql[1]).toMatch(/for no key update$/);
  });

  it("order for a resize: begin, item lock, in-use count, update, audit, commit; no room or seat lock, no map_item_catalogs statement", async () => {
    const f = fake(row());
    const r = await updateMapItem(f.pool, scope, SUB, "plant.large", { w: 2 });
    expect(r.ok).toBe(true);
    expect(f.sql.map((s) => s.split(" ").slice(0, 2).join(" "))).toEqual([
      "begin",
      "select builtin_key,",
      "select count(*)::int",
      "update map_items",
      "insert into",
      "commit",
    ]);
    expect(f.sql[2]).not.toMatch(/for (update|share|no key)/);
    expect(f.sql.join("\n")).not.toMatch(/map_item_catalogs|from rooms/);
  });

  it("refusals (not_found, item_in_use, fixed size, not_allowed, sprite_not_allowed) run no update and no audit", async () => {
    const noWrite = (sql: string[]) =>
      expect(sql.join("\n")).not.toMatch(/update map_items|audit_log/);
    let f = fake(null);
    expect(await updateMapItem(f.pool, scope, SUB, "plant.large", { name: "x" })).toEqual({
      ok: false,
      status: 404,
      code: "not_found",
    });
    noWrite(f.sql);
    f = fake(row(), 3);
    expect(await updateMapItem(f.pool, scope, SUB, "plant.large", { h: 2 })).toEqual({
      ok: false,
      status: 409,
      code: "item_in_use",
      rooms: 3,
    });
    noWrite(f.sql);
    expect(f.sql.at(-1)).toBe("rollback");
    f = fake(row({ builtin_key: "desk.single", w: 2 }));
    expect(await updateMapItem(f.pool, scope, SUB, "desk.single", { w: 3 })).toMatchObject({
      status: 422,
      code: "item_fixed_size",
    });
    expect(f.sql).toEqual([]);
    expect(await updateMapItem(f.pool, scope, SUB, "chair.office", { hidden: true })).toMatchObject(
      {
        status: 422,
        code: "not_allowed",
      },
    );
    expect(await setMapItemArt(f.pool, scope, SUB, "plant.large", "n", null)).toMatchObject({
      status: 422,
      code: "not_allowed",
    });
    expect(await setMapItemArt(f.pool, scope, SUB, "plant.large", "s", "floor.wood")).toMatchObject(
      {
        status: 422,
        code: "sprite_not_allowed",
      },
    );
    f = fake(row());
    expect(
      await setMapItemArt(f.pool, scope, SUB, "plant.large", "s", "table.meeting.n"),
    ).toMatchObject({ status: 422, code: "sprite_not_allowed" });
    noWrite(f.sql);
  });
});
