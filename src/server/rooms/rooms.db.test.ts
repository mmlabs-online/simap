import { randomUUID } from "node:crypto";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { validateRoomCreate, validateRoomPatch } from "@/lib/validate/room";
import { withTx } from "@/server/db/tx";
import {
  addDevice,
  addMember,
  addPendingRequest,
  addRoom,
  addSeat,
  assertTestDb,
  newOrg,
  testPool,
  waitForLockWait,
} from "@/test/db/fixtures";
import {
  allocateSeatSeq,
  createRoom,
  deleteRoom,
  getDeleteImpact,
  listRooms,
  updateRoom,
} from "./rooms";

let pool: pg.Pool;
const actor = () => randomUUID();

const create = (code: string, name = "Phòng C302") => {
  const v = validateRoomCreate({ code, name });
  if (!v.ok) throw new Error("bad fixture");
  return v.value;
};
const patch = (body: unknown) => {
  const v = validateRoomPatch(body);
  if (!v.ok) throw new Error("bad fixture");
  return v.value;
};
const count = async (sql: string, values: unknown[]) =>
  (await pool.query(sql, values)).rows[0].n as number;
const auditCount = (orgId: string, action: string) =>
  count("select count(*)::int as n from audit_log where org_id = $1 and action = $2", [
    orgId,
    action,
  ]);

beforeAll(async () => {
  pool = testPool();
  await assertTestDb(pool);
});
afterAll(async () => {
  await pool.end();
});

describe("rooms (db)", () => {
  describe("case 1: room codes", () => {
    it("same code in two orgs succeeds", async () => {
      const a = newOrg();
      const b = newOrg();
      const ra = await createRoom(pool, a.scope, actor(), create("C302"));
      const rb = await createRoom(pool, b.scope, actor(), create("C302"));
      expect(ra.ok).toBe(true);
      expect(rb.ok).toBe(true);
      const listA = await listRooms(pool, a.scope);
      const listB = await listRooms(pool, b.scope);
      expect(listA).toHaveLength(1);
      expect(listB).toHaveLength(1);
      expect(listA[0]).toMatchObject({
        code: "C302",
        name: "Phòng C302",
        description: null,
        floor: null,
        seatCount: 0,
        occupiedCount: 0,
      });
      expect(ra.ok && listA[0]!.id).toBe(ra.ok && ra.value.id);
      expect(rb.ok && listB[0]!.id).toBe(rb.ok && rb.value.id);
    });

    it("duplicate code in one org -> 409 room_code_taken", async () => {
      const a = newOrg();
      expect((await createRoom(pool, a.scope, actor(), create("C302"))).ok).toBe(true);
      const dup = await createRoom(pool, a.scope, actor(), create("C302"));
      expect(dup).toEqual({ ok: false, status: 409, code: "room_code_taken" });
      expect(await listRooms(pool, a.scope)).toHaveLength(1);
      expect(await auditCount(a.orgId, "room.create")).toBe(1);
    });

    it("duplicate differing only by case -> 409", async () => {
      const a = newOrg();
      expect((await createRoom(pool, a.scope, actor(), create("C302"))).ok).toBe(true);
      const lower = await createRoom(pool, a.scope, actor(), create(" c302"));
      expect(lower).toEqual({ ok: false, status: 409, code: "room_code_taken" });
      const other = await createRoom(pool, a.scope, actor(), create("D101"));
      expect(other.ok).toBe(true);
      const id = other.ok ? other.value.id : "";
      const upd = await updateRoom(pool, a.scope, actor(), id, patch({ code: "c302" }));
      expect(upd).toEqual({ ok: false, status: 409, code: "room_code_taken" });
      const rows = await listRooms(pool, a.scope);
      expect(rows.map((r) => r.code)).toEqual(["C302", "D101"]);
    });
  });

  describe("case 2: rename", () => {
    it("rewrites every seat code including seq >= 100", async () => {
      const a = newOrg();
      const roomId = await addRoom(pool, a.orgId, "C302", { seatCounter: 120 });
      const otherRoom = await addRoom(pool, a.orgId, "D101", { seatCounter: 1 });
      for (const s of [1, 7, 100, 120]) await addSeat(pool, a.orgId, roomId, "C302", s);
      await addSeat(pool, a.orgId, otherRoom, "D101", 1);

      const r = await updateRoom(pool, a.scope, actor(), roomId, patch({ code: "C303" }));
      expect(r.ok).toBe(true);
      const { rows } = await pool.query(
        "select code from seats where org_id = $1 and room_id = $2 order by seq",
        [a.orgId, roomId],
      );
      expect(rows.map((x) => x.code)).toEqual(["C303-01", "C303-07", "C303-100", "C303-120"]);
      const other = await pool.query("select code from seats where org_id = $1 and room_id = $2", [
        a.orgId,
        otherRoom,
      ]);
      expect(other.rows.map((x) => x.code)).toEqual(["D101-01"]);
      const audit = await pool.query(
        "select meta from audit_log where org_id = $1 and action = 'room.update' and entity_id = $2",
        [a.orgId, roomId],
      );
      expect(audit.rows).toHaveLength(1);
      expect(audit.rows[0].meta).toMatchObject({ from: "C302", to: "C303", seats: 4 });
    });

    it("is one transaction: a seat code conflict rolls back the room code", async () => {
      const a = newOrg();
      const roomId = await addRoom(pool, a.orgId, "C302", { seatCounter: 2 });
      const strayRoom = await addRoom(pool, a.orgId, "D101", { seatCounter: 1 });
      await addSeat(pool, a.orgId, roomId, "C302", 1);
      await addSeat(pool, a.orgId, roomId, "C302", 2);
      await addSeat(pool, a.orgId, strayRoom, "D101", 1, { code: "C309-01" });

      const r = await updateRoom(pool, a.scope, actor(), roomId, patch({ code: "C309" }));
      expect(r).toEqual({ ok: false, status: 409, code: "room_code_taken" });
      const room = await pool.query("select code from rooms where org_id = $1 and id = $2", [
        a.orgId,
        roomId,
      ]);
      expect(room.rows[0].code).toBe("C302");
      const seats = await pool.query(
        "select code from seats where org_id = $1 and room_id = $2 order by seq",
        [a.orgId, roomId],
      );
      expect(seats.rows.map((x) => x.code)).toEqual(["C302-01", "C302-02"]);
      expect(await auditCount(a.orgId, "room.update")).toBe(0);
    });
  });

  describe("case 3: seat counter (D30)", () => {
    it("keeps growing after a seat is deleted", async () => {
      const a = newOrg();
      const created = await createRoom(pool, a.scope, actor(), create("C302"));
      const roomId = created.ok ? created.value.id : "";
      const seqs: number[] = [];
      for (let i = 0; i < 2; i++) {
        await withTx(pool, async (c) => {
          const s = await allocateSeatSeq(c, a.scope, roomId);
          seqs.push(s!.seq);
          await c.query("insert into seats (org_id, room_id, seq, code) values ($1, $2, $3, $4)", [
            a.orgId,
            roomId,
            s!.seq,
            `${s!.roomCode}-0${s!.seq}`,
          ]);
        });
      }
      expect(seqs).toEqual([1, 2]);
      await pool.query("delete from seats where org_id = $1 and room_id = $2 and seq = 2", [
        a.orgId,
        roomId,
      ]);
      const third = await withTx(pool, (c) => allocateSeatSeq(c, a.scope, roomId));
      expect(third?.seq).toBe(3);
      const counter = () =>
        count("select seat_counter as n from rooms where org_id = $1 and id = $2", [
          a.orgId,
          roomId,
        ]);
      expect(await counter()).toBe(3);
      const foreign = await withTx(pool, (c) => allocateSeatSeq(c, newOrg().scope, roomId));
      expect(foreign).toBeNull();
      expect(await counter()).toBe(3);
    });
  });

  describe("case 4: delete", () => {
    const seedOccupied = async (orgId: string) => {
      const roomId = await addRoom(pool, orgId, "C302", { seatCounter: 2 });
      const member = await addMember(pool, orgId);
      const seatId = await addSeat(pool, orgId, roomId, "C302", 1, { occupantId: member });
      const deviceId = await addDevice(pool, orgId, member, seatId, "primary");
      return { roomId, member, seatId, deviceId };
    };

    it("plain delete with an occupant -> 409 room_not_empty", async () => {
      const a = newOrg();
      const { roomId, seatId, deviceId } = await seedOccupied(a.orgId);
      const r = await deleteRoom(pool, a.scope, actor(), roomId, false);
      expect(r).toEqual({ ok: false, status: 409, code: "room_not_empty" });
      expect(await count("select count(*)::int as n from rooms where id = $1", [roomId])).toBe(1);
      expect(await count("select count(*)::int as n from seats where id = $1", [seatId])).toBe(1);
      expect(
        await count("select count(*)::int as n from devices where id = $1 and seat_id = $2", [
          deviceId,
          seatId,
        ]),
      ).toBe(1);
      expect(await auditCount(a.orgId, "room.delete")).toBe(0);
    });

    it("forced delete with an occupant and a primary device passes the deferred trigger at COMMIT", async () => {
      const a = newOrg();
      const { roomId, member, deviceId } = await seedOccupied(a.orgId);
      const freeSeat = await addSeat(pool, a.orgId, roomId, "C302", 2);
      await addPendingRequest(pool, a.orgId, freeSeat, member);

      const r = await deleteRoom(pool, a.scope, actor(), roomId, true);
      expect(r).toEqual({ ok: true, value: null });
      expect(await count("select count(*)::int as n from rooms where id = $1", [roomId])).toBe(0);
      expect(await count("select count(*)::int as n from seats where room_id = $1", [roomId])).toBe(
        0,
      );
      expect(
        await count("select count(*)::int as n from seat_requests where org_id = $1", [a.orgId]),
      ).toBe(0);
      const dev = await pool.query("select seat_id, role from devices where id = $1", [deviceId]);
      expect(dev.rows[0]).toEqual({ seat_id: null, role: "secondary" });
      const audit = await pool.query(
        "select entity_id, meta from audit_log where org_id = $1 and action = 'room.delete'",
        [a.orgId],
      );
      expect(audit.rows).toHaveLength(1);
      expect(audit.rows[0].entity_id).toBe(roomId);
      expect(audit.rows[0].meta).toEqual({
        code: "C302",
        seats: 2,
        devices: 1,
        pending: 1,
        forced: true,
      });
    });

    it("negative control: an occupant change without demote fails at COMMIT", async () => {
      const a = newOrg();
      const { seatId } = await seedOccupied(a.orgId);
      const other = await addMember(pool, a.orgId);
      const c = await pool.connect();
      try {
        await c.query("begin");
        await c.query("update seats set occupant_id = $3 where org_id = $1 and id = $2", [
          a.orgId,
          seatId,
          other,
        ]);
        await expect(c.query("commit")).rejects.toMatchObject({
          code: "23514",
          constraint: "devices_primary_owner_is_occupant",
        });
      } finally {
        await c.query("rollback").catch(() => {});
        c.release();
      }
    });

    it("plain delete waits for a concurrent occupant change and then refuses", async () => {
      const a = newOrg();
      const roomId = await addRoom(pool, a.orgId, "C302", { seatCounter: 1 });
      const seatId = await addSeat(pool, a.orgId, roomId, "C302", 1);
      const member = await addMember(pool, a.orgId);
      const holder = await pool.connect();
      try {
        await holder.query("begin");
        await holder.query("update seats set occupant_id = $3 where org_id = $1 and id = $2", [
          a.orgId,
          seatId,
          member,
        ]);
        const pending = deleteRoom(pool, a.scope, actor(), roomId, false);
        const waited = await waitForLockWait(pool, 3000);
        await holder.query("commit");
        const r = await pending;
        expect(waited).toBe(true);
        expect(r).toEqual({ ok: false, status: 409, code: "room_not_empty" });
        expect(await count("select count(*)::int as n from rooms where id = $1", [roomId])).toBe(1);
        expect(
          await count("select count(*)::int as n from seats where id = $1 and occupant_id = $2", [
            seatId,
            member,
          ]),
        ).toBe(1);
      } finally {
        await holder.query("rollback").catch(() => {});
        holder.release();
      }
    });
  });

  describe("case 5: other org's room id", () => {
    it("-> 404 for update and delete", async () => {
      const a = newOrg();
      const b = newOrg();
      const roomId = await addRoom(pool, b.orgId, "C302");
      const nf = { ok: false, status: 404, code: "not_found" };
      expect(await updateRoom(pool, a.scope, actor(), roomId, patch({ name: "X" }))).toEqual(nf);
      expect(await updateRoom(pool, a.scope, actor(), roomId, patch({ code: "Z9" }))).toEqual(nf);
      expect(await deleteRoom(pool, a.scope, actor(), roomId, false)).toEqual(nf);
      expect(await deleteRoom(pool, a.scope, actor(), roomId, true)).toEqual(nf);
      expect(await getDeleteImpact(pool, a.scope, roomId)).toEqual(nf);
      const room = await pool.query("select code, name from rooms where id = $1", [roomId]);
      expect(room.rows).toEqual([{ code: "C302", name: "Room C302" }]);
      expect(
        await count("select count(*)::int as n from audit_log where org_id = $1", [a.orgId]),
      ).toBe(0);
    });
  });
});
