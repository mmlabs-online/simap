import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const read = vi.hoisted(() => ({ readLayoutRows: vi.fn() }));
vi.mock("./layout", () => ({ readLayoutRows: read.readLayoutRows }));

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
    x: i,
    y: 0,
    rotation: 90 as const,
  })),
  fixtures: Array.from({ length: nFixtures }, () => ({
    sprite: "plant.large",
    x: 1,
    y: 1,
    rotation: 0 as const,
  })),
});

type Call = { text: string; values?: unknown[] };

/** A fake client: `version` is the stored layout_version, `seatIds` the room's locked seat rows. */
function fake(opts: { version?: number | null; seatIds: string[] }) {
  const calls: Call[] = [];
  const client = {
    async query(text: string, values?: unknown[]) {
      calls.push({ text, values });
      if (/from rooms where/.test(text) && /for update/.test(text)) {
        return { rows: opts.version === null ? [] : [{ layout_version: opts.version ?? 2 }] };
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
  it("runs begin, room lock, seat lock, catalog seed, seat update, fixture delete, insert, room update, audit, re-read, commit", async () => {
    const f = fake({ seatIds: [sid(1), sid(2)] });
    const r = await run(f, value(2));
    expect(r).toEqual({ ok: true, value: { version: 3, seatDevices: {} } });
    expect(kinds(f.calls)).toEqual([
      "begin",
      "room lock",
      "seat lock",
      "catalog seed",
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
      [0, 1],
      [0, 0],
      [90, 90],
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
});
