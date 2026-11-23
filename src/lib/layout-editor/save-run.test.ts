import { describe, expect, it } from "vitest";
import type { LayoutSaveValue, RoomLayout } from "@/lib/sprites/layout";
import type { MapView } from "@/lib/sprites/map-view";
import { validateLayoutSave } from "@/lib/validate/layout";
import { deleteItems, draftFromLayout, placeItem } from "./draft";
import { runSave, type SaveApi, type SaveInput, type SaveOutcome } from "./save-run";
import type { Draft, OpResult } from "./types";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const C = "00000000-0000-4000-8000-00000000000c";

const layout = (p: Partial<RoomLayout> = {}): RoomLayout => ({
  w: 12,
  h: 8,
  floors: [],
  seats: [
    { id: A, code: "Phòng-A-01", sprite: "desk.single", x: 0, y: 0, rotation: 0 },
    { id: B, code: "Phòng-A-02", sprite: "desk.single", x: 4, y: 0, rotation: 0 },
    { id: C, code: "Phòng-A-05", sprite: "desk.single", x: 8, y: 4, rotation: 0 },
  ],
  fixtures: [],
  ...p,
});
const ok = (r: OpResult): Draft => {
  if (!r.ok) throw new Error(`refused: ${r.code}`);
  return r.draft;
};

type R<T> = { ok: true; value: T } | { ok: false; code: string };
type Call = { method: "remove"; id: string } | { method: "add"; n: number } | { method: "put" };

const VIEW = { version: 8, layout: layout() } as unknown as MapView;

/** A fake API: scripted results per call, in order; unscripted calls succeed. Records every call. */
function fakeApi(
  script: {
    remove?: Record<string, (R<null> | "throw")[]>;
    add?: (R<{ id: string; code: string; seq: number }[]> | undefined)[];
    put?: R<MapView>[];
    firstSeq?: number;
  } = {},
) {
  const calls: Call[] = [];
  const bodies: LayoutSaveValue[] = [];
  let seq = script.firstSeq ?? 6;
  let made = 0;
  const addQueue = [...(script.add ?? [])];
  const putQueue = [...(script.put ?? [])];
  const api: SaveApi = {
    remove: async (id) => {
      calls.push({ method: "remove", id });
      const r = script.remove?.[id]?.shift();
      if (r === "throw") throw new Error("boom");
      return r ?? { ok: true, value: null };
    },
    add: async (_room, n) => {
      calls.push({ method: "add", n });
      const scripted = addQueue.shift();
      if (scripted) return scripted;
      const items = Array.from({ length: n }, () => {
        const s = seq++;
        made++;
        return {
          id: `00000000-0000-4000-8000-${(0x1000 + made).toString(16).padStart(12, "0")}`,
          code: `Phòng-A-${String(s).padStart(2, "0")}`,
          seq: s,
        };
      });
      return { ok: true, value: items };
    },
    saveLayout: async (_room, body) => {
      calls.push({ method: "put" });
      bodies.push(body);
      return putQueue.shift() ?? { ok: true, value: VIEW };
    },
  };
  return { api, calls, bodies, created: () => made };
}

const input = (draft: Draft, baseline: Draft = draft): SaveInput => ({
  draft,
  baseline,
  baseVersion: 7,
  roomId: "room-1",
});
const baselineDraft = () => draftFromLayout(layout(), []);
const failed = (o: SaveOutcome) => {
  if (o.status !== "failed") throw new Error("expected failed");
  return o;
};
const methods = (calls: Call[]) => calls.map((c) => c.method);

describe("runSave", () => {
  it("no seat changes: only the PUT, with baseVersion; outcome saved with the response view", async () => {
    const f = fakeApi();
    const base = baselineDraft();
    const out = await runSave(input(base), f.api);
    expect(out).toEqual({ status: "saved", view: VIEW });
    expect(methods(f.calls)).toEqual(["put"]);
    expect(f.bodies[0].baseVersion).toBe(7);
  });

  it("deletes, then creates, then PUT: one DELETE per removed seat, POST {count} = new desks, PUT body has the created ids at the new desks' tiles and no removed seat, and passes validateLayoutSave", async () => {
    const f = fakeApi();
    const base = baselineDraft();
    let d = ok(deleteItems(base, [`s:${A}`, `s:${B}`]));
    d = ok(placeItem(d, "desk.single", 0, 4));
    d = ok(placeItem(d, "desk.single", 4, 4));
    const out = await runSave(input(d, base), f.api);
    expect(out.status).toBe("saved");
    expect(f.calls).toEqual([
      { method: "remove", id: A },
      { method: "remove", id: B },
      { method: "add", n: 2 },
      { method: "put" },
    ]);
    const seats = f.bodies[0].seats;
    expect(seats.map((s) => s.id)).not.toContain(A);
    expect(seats.map((s) => s.id)).not.toContain(B);
    expect(seats).toHaveLength(3);
    expect(seats.filter((s) => s.id !== C).map((s) => [s.x, s.y])).toEqual([
      [0, 4],
      [4, 4],
    ]);
    expect(validateLayoutSave(f.bodies[0]).ok).toBe(true);
  });

  it("created seats map by ascending seq onto new desks in add order, codes from the response (Phòng-A-06, Phòng-A-07 after a gap at 04)", async () => {
    const id6 = "00000000-0000-4000-8000-000000000006";
    const id7 = "00000000-0000-4000-8000-000000000007";
    const f = fakeApi({
      add: [
        {
          ok: true,
          value: [
            { id: id7, code: "Phòng-A-07", seq: 7 },
            { id: id6, code: "Phòng-A-06", seq: 6 },
          ],
        },
      ],
      put: [{ ok: false, code: "unavailable" }],
    });
    let d = baselineDraft();
    d = ok(placeItem(d, "desk.single", 0, 4));
    d = ok(placeItem(d, "desk.single", 4, 4));
    const out = failed(await runSave(input(d), f.api));
    const items = out.progress?.draft.items ?? [];
    expect(items.find((i) => i.x === 0 && i.y === 4)).toMatchObject({
      seatId: id6,
      code: "Phòng-A-06",
    });
    expect(items.find((i) => i.x === 4 && i.y === 4)).toMatchObject({
      seatId: id7,
      code: "Phòng-A-07",
    });
  });

  it("DELETE 409 seat_not_empty on the 2nd seat after a 1st success: the 2nd is restored at its baseline tile, no POST, no PUT; code seat_not_empty; detail {stage delete, deleted 1, seat code, restored map}; baseline without the 1st seat; reset true", async () => {
    const f = fakeApi({ remove: { [B]: [{ ok: false, code: "seat_not_empty" }] } });
    const base = baselineDraft();
    let d = ok(deleteItems(base, [`s:${A}`, `s:${B}`]));
    d = ok(placeItem(d, "desk.single", 0, 4));
    const out = failed(await runSave(input(d, base), f.api));
    expect(methods(f.calls)).toEqual(["remove", "remove"]);
    expect(out.code).toBe("seat_not_empty");
    expect(out.detail).toEqual({
      stage: "delete",
      deleted: 1,
      created: 0,
      seat: "Phòng-A-02",
      restored: "map",
    });
    const p = out.progress!;
    expect(p.reset).toBe(true);
    expect(p.draft.items.find((i) => i.seatId === B)).toMatchObject({ x: 4, y: 0 });
    expect(p.draft.removed).toEqual([]);
    expect(p.baseline.items.some((i) => i.seatId === A)).toBe(false);
    expect(p.baseline.items.some((i) => i.seatId === B)).toBe(true);
  });

  it("DELETE 409 when the seat's baseline tile is now taken: restored into the tray (restored tray); on the first seat: reset false", async () => {
    const f = fakeApi({ remove: { [A]: [{ ok: false, code: "seat_not_empty" }] } });
    const base = baselineDraft();
    let d = ok(deleteItems(base, [`s:${A}`]));
    d = ok(placeItem(d, "plant.large", 0, 0));
    const out = failed(await runSave(input(d, base), f.api));
    expect(out.detail.restored).toBe("tray");
    expect(out.detail.seat).toBe("Phòng-A-01");
    expect(out.progress?.reset).toBe(false);
    expect(out.progress?.draft.tray).toEqual([{ id: A, code: "Phòng-A-01" }]);
    expect(methods(f.calls)).toEqual(["remove"]);
  });

  it("DELETE 404 not_found counts as deleted and the run goes on", async () => {
    const f = fakeApi({ remove: { [A]: [{ ok: false, code: "not_found" }] } });
    const base = baselineDraft();
    const d = ok(deleteItems(base, [`s:${A}`]));
    const out = await runSave(input(d, base), f.api);
    expect(out.status).toBe("saved");
    expect(methods(f.calls)).toEqual(["remove", "put"]);
  });

  it("DELETE unavailable: the seat stays in removed, stop, no POST or PUT", async () => {
    const f = fakeApi({ remove: { [B]: [{ ok: false, code: "unavailable" }] } });
    const base = baselineDraft();
    let d = ok(deleteItems(base, [`s:${A}`, `s:${B}`]));
    d = ok(placeItem(d, "desk.single", 0, 4));
    const out = failed(await runSave(input(d, base), f.api));
    expect(out.code).toBe("unavailable");
    expect(methods(f.calls)).toEqual(["remove", "remove"]);
    expect(out.progress?.draft.removed).toEqual([{ id: B, code: "Phòng-A-02" }]);
    expect(out.detail).toMatchObject({ stage: "delete", deleted: 1, seat: null });
  });

  it("60 new desks: POST 50 then POST 10; when the 2nd POST fails, the first 50 desks have ids and codes, 10 stay new, no PUT; detail created 50", async () => {
    const f = fakeApi({ add: [undefined, { ok: false, code: "unavailable" }] });
    let d = draftFromLayout({ w: 64, h: 64, floors: [], seats: [], fixtures: [] }, []);
    for (let k = 0; k < 60; k++) {
      d = ok(placeItem(d, "desk.single", (k % 16) * 4, Math.floor(k / 16) * 4));
    }
    const out = failed(await runSave(input(d), f.api));
    expect(f.calls.filter((c) => c.method === "add")).toEqual([
      { method: "add", n: 50 },
      { method: "add", n: 10 },
    ]);
    expect(methods(f.calls)).not.toContain("put");
    const items = out.progress!.draft.items;
    expect(items.filter((i) => i.seatId !== null && i.code !== null)).toHaveLength(50);
    expect(items.filter((i) => i.seatId === null)).toHaveLength(10);
    expect(out.detail).toMatchObject({ stage: "create", created: 50 });
    expect(out.progress?.reset).toBe(true);
  });

  it("POST returns fewer seats than asked: seats_unmatched, that chunk's desks stay new, no PUT", async () => {
    const f = fakeApi({
      add: [
        { ok: true, value: [{ id: "00000000-0000-4000-8000-000000000009", code: "X-09", seq: 9 }] },
      ],
    });
    let d = baselineDraft();
    d = ok(placeItem(d, "desk.single", 0, 4));
    d = ok(placeItem(d, "desk.single", 4, 4));
    const out = failed(await runSave(input(d), f.api));
    expect(out.code).toBe("seats_unmatched");
    expect(out.detail.stage).toBe("assign");
    expect(methods(f.calls)).toEqual(["add"]);
    expect((out.progress?.draft ?? d).items.filter((i) => i.seatId === null)).toHaveLength(2);
  });

  it("PUT fails after creates: the draft has the created ids, removed is empty, the PUT code is passed through (unavailable, layout_stale); detail {stage put, created N}", async () => {
    for (const code of ["unavailable", "layout_stale"]) {
      const f = fakeApi({ put: [{ ok: false, code }] });
      const base = baselineDraft();
      let d = ok(deleteItems(base, [`s:${A}`]));
      d = ok(placeItem(d, "desk.single", 0, 4));
      const out = failed(await runSave(input(d, base), f.api));
      expect(out.code).toBe(code);
      expect(out.detail).toMatchObject({ stage: "put", created: 1, deleted: 1 });
      expect(out.progress?.draft.removed).toEqual([]);
      expect(out.progress?.draft.items.every((i) => i.seatId !== null)).toBe(true);
      expect(out.progress?.reset).toBe(true);
    }
  });

  it("retry after a DELETE failure, a 2nd-chunk failure and a PUT failure sends only the remaining calls; no seat is created twice", async () => {
    const f = fakeApi({
      remove: { [B]: [{ ok: false, code: "unavailable" }] },
      add: [{ ok: false, code: "unavailable" }],
      put: [{ ok: false, code: "unavailable" }],
    });
    const base = baselineDraft();
    let d = ok(deleteItems(base, [`s:${A}`, `s:${B}`]));
    d = ok(placeItem(d, "desk.single", 0, 4));
    d = ok(placeItem(d, "desk.single", 4, 4));
    const next = async (prev: SaveOutcome | null) => {
      f.calls.length = 0;
      const p = prev && failed(prev).progress;
      return runSave(input(p ? p.draft : d, p ? p.baseline : base), f.api);
    };

    const r1 = await next(null);
    expect(f.calls).toEqual([
      { method: "remove", id: A },
      { method: "remove", id: B },
    ]);
    const r2 = await next(r1);
    expect(f.calls).toEqual([
      { method: "remove", id: B },
      { method: "add", n: 2 },
    ]);
    expect(failed(r2).code).toBe("unavailable");
    const r3 = await next(r2);
    expect(f.calls).toEqual([{ method: "add", n: 2 }, { method: "put" }]);
    const r4 = await next(r3);
    expect(f.calls).toEqual([{ method: "put" }]);
    expect(r4.status).toBe("saved");
    expect(f.created()).toBe(2);
  });

  it("an api method that throws resolves to failed internal with the progress so far", async () => {
    const f = fakeApi({ remove: { [B]: ["throw"] } });
    const base = baselineDraft();
    const d = ok(deleteItems(base, [`s:${A}`, `s:${B}`]));
    const out = failed(await runSave(input(d, base), f.api));
    expect(out.code).toBe("internal");
    expect(out.detail.deleted).toBe(1);
    expect(out.progress?.draft.removed).toEqual([{ id: B, code: "Phòng-A-02" }]);
  });

  it("tray not empty: failed unplaced, no calls", async () => {
    const f = fakeApi();
    const d = draftFromLayout(layout(), [{ id: "t1", code: "Phòng-A-09" }]);
    const out = failed(await runSave(input(d), f.api));
    expect(out.code).toBe("unplaced");
    expect(out.progress).toBeNull();
    expect(f.calls).toEqual([]);
  });
});
