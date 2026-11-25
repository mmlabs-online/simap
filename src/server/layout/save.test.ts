import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const read = vi.hoisted(() => ({ readLayoutRows: vi.fn() }));
vi.mock("./layout", () => ({ readLayoutRows: read.readLayoutRows }));

import { LIBRARY_ITEMS } from "@/lib/map-items/library";
import type { LayoutSaveValue } from "@/lib/sprites/layout";
import type { OrgScope } from "@/server/http/org-scope";
import { saveRoomLayout } from "./save";

const scope = { orgId: "11111111-1111-4111-8111-111111111111" } as unknown as OrgScope;
const ROOM = "33333333-3333-4333-8333-333333333333";
const sid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const value = (nSeats: number, nFixtures = 1, baseVersion = 2): LayoutSaveValue => ({
  baseVersion,
  w: 12,
  h: 8,
  floors: [{ sprite: "floor.wood", x: 0, y: 0, w: 6, h: 4 }],
  seats: Array.from({ length: nSeats }, (_, i) => ({
    id: sid(i + 1),
    sprite: "desk.single",
    x: i * 4,
    y: 0,
    rotation: 0 as const,
  })),
  fixtures: Array.from({ length: nFixtures }, (_, i) => ({
    sprite: "plant.large",
    x: 2 * i,
    y: 6,
    rotation: 0 as const,
  })),
});

type Call = { text: string; values?: unknown[] };

type CatalogOverride = { w?: number; h?: number; hidden?: boolean; missing?: boolean };

/**
 * A fake client: `version` is the stored layout_version, `seatIds` the room's locked seat rows.
 * `catalog` overrides library rows by key; `stored` is the per-key fixture count in the room;
 * `room` is the stored grid and floors.
 */
function fake(opts: {
  version?: number | null;
  seatIds: string[];
  catalog?: Record<string, CatalogOverride>;
  stored?: Record<string, number>;
  room?: { grid_w: number | null; grid_h: number | null; floor_zones: unknown };
}) {
  const calls: Call[] = [];
  const client = {
    async query(text: string, values?: unknown[]) {
      calls.push({ text, values });
      if (/from rooms where/.test(text) && /for update/.test(text)) {
        return { rows: opts.version === null ? [] : [{ layout_version: opts.version ?? 2 }] };
      }
      if (/from map_items/.test(text)) {
        const keys = (values?.[1] ?? []) as string[];
        const rows = keys.flatMap((k) => {
          const lib = LIBRARY_ITEMS.find((i) => i.builtinKey === k);
          const o = opts.catalog?.[k] ?? {};
          if (!lib || o.missing) return [];
          return [{ builtin_key: k, w: o.w ?? lib.w, h: o.h ?? lib.h, hidden: o.hidden ?? false }];
        });
        return { rows };
      }
      if (/select sprite_key, count/.test(text)) {
        const keys = (values?.[2] ?? []) as string[];
        return {
          rows: keys.flatMap((k) =>
            opts.stored?.[k] ? [{ sprite_key: k, n: opts.stored[k] }] : [],
          ),
        };
      }
      if (/select grid_w/.test(text)) {
        return { rows: [opts.room ?? { grid_w: null, grid_h: null, floor_zones: null }] };
      }
      if (/from seats where/.test(text)) return { rows: opts.seatIds.map((id) => ({ id })) };
      if (/update rooms set/.test(text)) return { rows: [{ layout_version: 3 }] };
      return { rows: [] };
    },
    release() {},
  };
  return { pool: { connect: async () => client }, calls };
}

const kinds = (calls: Call[]) =>
  calls.map((c) => {
    const t = c.text.trim().replace(/\s+/g, " ");
    if (/^(begin|commit|rollback)$/.test(t)) return t;
    if (/^select layout_version/.test(t)) return "room lock";
    if (/^select id from seats/.test(t)) return "seat lock";
    if (/^select map_items_seed/.test(t)) return "catalog seed";
    if (/^select builtin_key, w, h, hidden from map_items/.test(t)) return "catalog sizes";
    if (/^select sprite_key, count/.test(t)) return "hidden counts";
    if (/^select grid_w/.test(t)) return "hidden floors";
    if (/^update seats/.test(t)) return "seat update";
    if (/^delete from layout_fixtures/.test(t)) return "fixture delete";
    if (/^insert into layout_fixtures/.test(t)) return "fixture insert";
    if (/^update rooms/.test(t)) return "room update";
    if (/^insert into audit_log/.test(t)) return "audit";
    return t;
  });

const run = (f: ReturnType<typeof fake>, v: LayoutSaveValue) => {
  read.readLayoutRows.mockReset();
  read.readLayoutRows.mockImplementation(async () => {
    f.calls.push({ text: "re-read" });
    return { version: 3, seatDevices: {} };
  });
  return saveRoomLayout(f.pool, scope, "sub-1", ROOM, v);
};

describe("saveRoomLayout", () => {
  it("runs begin, room lock, seat lock, catalog seed, catalog sizes, seat update, fixture delete, insert, room update, audit, re-read, commit", async () => {
    const f = fake({ seatIds: [sid(1), sid(2)] });
    const r = await run(f, value(2));
    expect(r).toEqual({ ok: true, value: { version: 3, seatDevices: {} } });
    expect(kinds(f.calls)).toEqual([
      "begin",
      "room lock",
      "seat lock",
      "catalog seed",
      "catalog sizes",
      "seat update",
      "fixture delete",
      "fixture insert",
      "room update",
      "audit",
      "re-read",
      "commit",
    ]);
  });

  it("seat lock is capped at 501 rows and 501 rows gives layout_too_many_seats with no write", async () => {
    const ids = Array.from({ length: 501 }, (_, i) => sid(i + 1));
    const f = fake({ seatIds: ids });
    const r = await run(f, value(0));
    expect(r).toEqual({ ok: false, status: 422, code: "layout_too_many_seats" });
    expect(f.calls.find((c) => /from seats where/.test(c.text))!.text).toContain("limit 501");
    expect(kinds(f.calls)).toEqual(["begin", "room lock", "seat lock", "rollback"]);
  });

  it("stale version rolls back before the seat lock", async () => {
    const f = fake({ version: 5, seatIds: [] });
    const r = await run(f, value(0));
    expect(r).toEqual({ ok: false, status: 409, code: "layout_stale" });
    expect(kinds(f.calls)).toEqual(["begin", "room lock", "rollback"]);
  });

  it("a missing room is 404", async () => {
    const f = fake({ version: null, seatIds: [] });
    expect(await run(f, value(0))).toEqual({ ok: false, status: 404, code: "not_found" });
  });

  it("set comparison: missing, extra and unknown id give the same refusal and no write", async () => {
    const cases: [string[], LayoutSaveValue][] = [
      [[sid(1), sid(2)], value(1)],
      [[sid(1)], value(2)],
      [
        [sid(1), sid(2)],
        { ...value(2), seats: [value(2).seats[0]!, { ...value(2).seats[1]!, id: sid(9) }] },
      ],
    ];
    for (const [ids, v] of cases) {
      const f = fake({ seatIds: ids });
      expect(await run(f, v)).toEqual({ ok: false, status: 409, code: "layout_seats_changed" });
      expect(kinds(f.calls)).toEqual(["begin", "room lock", "seat lock", "rollback"]);
    }
  });

  it("zero seats skips the seat update; zero fixtures still deletes and skips the insert", async () => {
    const f = fake({ seatIds: [] });
    await run(f, value(0, 0));
    const k = kinds(f.calls);
    expect(k).not.toContain("seat update");
    expect(k).toContain("fixture delete");
    expect(k).not.toContain("fixture insert");
  });

  it("seat UPDATE text keeps s.org_id = $1 and s.room_id = $2; uses one unnest statement", async () => {
    const f = fake({ seatIds: [sid(1), sid(2)] });
    await run(f, value(2));
    const updates = f.calls.filter((c) => /^\s*update seats/.test(c.text));
    expect(updates).toHaveLength(1);
    expect(updates[0]!.text).toContain("s.org_id = $1 and s.room_id = $2");
    expect(updates[0]!.text).toContain("unnest(");
    expect(updates[0]!.values).toEqual([
      scope.orgId,
      ROOM,
      [sid(1), sid(2)],
      [0, 4],
      [0, 0],
      [0, 0],
      ["desk.single", "desk.single"],
    ]);
  });

  it("floor_zones is bound as a JSON string", async () => {
    const f = fake({ seatIds: [] });
    const v = value(0);
    await run(f, v);
    const up = f.calls.find((c) => /^\s*update rooms/.test(c.text))!;
    expect(up.values).toEqual([scope.orgId, ROOM, 12, 8, JSON.stringify(v.floors)]);
  });

  it("audit meta holds counts and versions only", async () => {
    const f = fake({ seatIds: [sid(1)] });
    await run(f, value(1, 2));
    const audit = f.calls.find((c) => /insert into audit_log/.test(c.text))!;
    expect(audit.values![1]).toBe("sub-1");
    expect(audit.values![2]).toBe("room.layout_save");
    expect(JSON.parse(audit.values![5] as string)).toEqual({
      seats: 1,
      fixtures: 2,
      floors: 1,
      baseVersion: 2,
      version: 3,
    });
  });

  it("catalog sizes statement: org_id = $1, distinct sorted seat+fixture+floor keys, order by builtin_key for key share", async () => {
    const f = fake({ seatIds: [sid(1)] });
    await run(f, value(1, 2));
    const q = f.calls.find((c) => /from map_items/.test(c.text))!;
    expect(q.text).toContain("org_id = $1");
    expect(q.text).toContain("order by builtin_key for key share");
    expect(q.values).toEqual([scope.orgId, ["desk.single", "floor.wood", "plant.large"]]);
  });

  it("a rule failure at catalog size (plant.large 2x2) gives 422 layout_overlap with no write and no audit", async () => {
    const f = fake({ seatIds: [], catalog: { "plant.large": { w: 2, h: 2 } } });
    const plant = value(0, 1).fixtures[0]!;
    const v = {
      ...value(0, 0),
      fixtures: [
        { ...plant, x: 0, y: 5 },
        { ...plant, x: 1, y: 6 },
      ],
    };
    expect(await run(f, v)).toEqual({ ok: false, status: 422, code: "layout_overlap" });
    expect(kinds(f.calls)).toEqual([
      "begin",
      "room lock",
      "seat lock",
      "catalog seed",
      "catalog sizes",
      "rollback",
    ]);
  });

  it("a key missing from the catalog gives 422 layout_unknown_sprite with no write", async () => {
    const f = fake({ seatIds: [], catalog: { "plant.large": { missing: true } } });
    expect(await run(f, value(0))).toEqual({
      ok: false,
      status: 422,
      code: "layout_unknown_sprite",
    });
    expect(kinds(f.calls).at(-1)).toBe("rollback");
    expect(kinds(f.calls)).not.toContain("fixture delete");
  });

  it("hidden fixture: stored count 1, submitted 1 proceeds; submitted 2 gives 422 layout_item_hidden after hidden counts, no write, no audit", async () => {
    const catalog = { "plant.large": { hidden: true } };
    const ok = fake({ seatIds: [], catalog, stored: { "plant.large": 1 } });
    expect((await run(ok, value(0, 1))).ok).toBe(true);
    expect(kinds(ok.calls)).toContain("hidden counts");

    const no = fake({ seatIds: [], catalog, stored: { "plant.large": 1 } });
    expect(await run(no, value(0, 2))).toEqual({
      ok: false,
      status: 422,
      code: "layout_item_hidden",
    });
    expect(kinds(no.calls)).toEqual([
      "begin",
      "room lock",
      "seat lock",
      "catalog seed",
      "catalog sizes",
      "hidden counts",
      "rollback",
    ]);
  });

  it("no hidden key: no hidden counts or hidden floors statement", async () => {
    const f = fake({ seatIds: [sid(1)] });
    await run(f, value(1, 2));
    expect(kinds(f.calls)).not.toContain("hidden counts");
    expect(kinds(f.calls)).not.toContain("hidden floors");
  });

  it("hidden desk.single: seats save, no hidden check", async () => {
    const f = fake({ seatIds: [sid(1)], catalog: { "desk.single": { hidden: true } } });
    expect((await run(f, value(1, 0))).ok).toBe(true);
    expect(kinds(f.calls)).not.toContain("hidden counts");
    expect(kinds(f.calls)).not.toContain("hidden floors");
  });

  it("hidden floor: kept when the room already shows it, refused when it is new", async () => {
    const catalog = { "floor.wood": { hidden: true } };
    const shown = fake({
      seatIds: [],
      catalog,
      room: {
        grid_w: 12,
        grid_h: 8,
        floor_zones: [{ sprite: "floor.wood", x: 0, y: 0, w: 12, h: 8 }],
      },
    });
    expect((await run(shown, value(0, 0))).ok).toBe(true);
    expect(kinds(shown.calls)).toContain("hidden floors");

    const added = fake({
      seatIds: [],
      catalog,
      room: {
        grid_w: 12,
        grid_h: 8,
        floor_zones: [{ sprite: "floor.carpet", x: 0, y: 0, w: 12, h: 8 }],
      },
    });
    expect(await run(added, value(0, 0))).toEqual({
      ok: false,
      status: 422,
      code: "layout_item_hidden",
    });
  });
});
