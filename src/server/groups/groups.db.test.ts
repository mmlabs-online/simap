import { randomUUID } from "node:crypto";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setSeatTags } from "@/server/seats/seats";
import { addMember, addRoom, addSeat, assertTestDb, newOrg, testPool } from "@/test/db/fixtures";
import {
  createGroup,
  createProject,
  deleteGroup,
  deleteProject,
  getGroupImpact,
  getProjectImpact,
  listGroups,
  updateGroup,
} from "./groups";

let pool: pg.Pool;
const actor = () => randomUUID();
const G = (name: string) => ({ name, color: "#5B6CF0" });
const P = (code: string) => ({ code, name: `Project ${code}` });

const count = async (sql: string, values: unknown[]) =>
  (await pool.query(sql, values)).rows[0].n as number;
const auditCount = (orgId: string, action: string) =>
  count("select count(*)::int as n from audit_log where org_id = $1 and action = $2", [
    orgId,
    action,
  ]);

async function mkGroup(scope: ReturnType<typeof newOrg>["scope"], name: string) {
  const r = await createGroup(pool, scope, actor(), G(name));
  if (!r.ok) throw new Error("fixture");
  return r.value.id;
}
async function mkProject(scope: ReturnType<typeof newOrg>["scope"], code: string) {
  const r = await createProject(pool, scope, actor(), P(code));
  if (!r.ok) throw new Error("fixture");
  return r.value.id;
}
const seatRow = async (id: string) =>
  (await pool.query("select group_id, project_id from seats where id = $1", [id])).rows[0];

beforeAll(async () => {
  pool = testPool();
  await assertTestDb(pool);
});
afterAll(async () => {
  await pool.end();
});

describe("groups and projects (db)", () => {
  it("duplicate group name in one org -> group_name_taken; other org allowed", async () => {
    const a = newOrg();
    const b = newOrg();
    expect((await createGroup(pool, a.scope, actor(), G("Dev"))).ok).toBe(true);
    expect(await createGroup(pool, a.scope, actor(), G("Dev"))).toEqual({
      ok: false,
      status: 409,
      code: "group_name_taken",
    });
    expect((await createGroup(pool, b.scope, actor(), G("Dev"))).ok).toBe(true);
    const other = await mkGroup(a.scope, "Ops");
    expect(await updateGroup(pool, a.scope, actor(), other, { name: "Dev" })).toEqual({
      ok: false,
      status: 409,
      code: "group_name_taken",
    });
    expect((await listGroups(pool, a.scope)).map((g) => g.name)).toEqual(["Dev", "Ops"]);
    expect(await auditCount(a.orgId, "group.create")).toBe(2);
  });

  it("duplicate project code -> project_code_taken; other org allowed", async () => {
    const a = newOrg();
    const b = newOrg();
    expect((await createProject(pool, a.scope, actor(), P("ALPHA"))).ok).toBe(true);
    expect(await createProject(pool, a.scope, actor(), P("ALPHA"))).toEqual({
      ok: false,
      status: 409,
      code: "project_code_taken",
    });
    expect((await createProject(pool, b.scope, actor(), P("ALPHA"))).ok).toBe(true);
  });

  it("delete used group without force -> in_use and nothing changes", async () => {
    const a = newOrg();
    const room = await addRoom(pool, a.orgId, "R1");
    const seat = await addSeat(pool, a.orgId, room, "R1", 1);
    const gid = await mkGroup(a.scope, "Dev");
    expect((await setSeatTags(pool, a.scope, actor(), seat, { groupId: gid })).ok).toBe(true);
    expect(await deleteGroup(pool, a.scope, actor(), gid, false)).toEqual({
      ok: false,
      status: 409,
      code: "in_use",
    });
    expect((await seatRow(seat)).group_id).toBe(gid);
    expect(await listGroups(pool, a.scope)).toHaveLength(1);
    expect(await auditCount(a.orgId, "group.delete")).toBe(0);
  });

  it("force delete clears seats and members, keeps other groups' tags, writes audit", async () => {
    const a = newOrg();
    const room = await addRoom(pool, a.orgId, "R1");
    const s1 = await addSeat(pool, a.orgId, room, "R1", 1);
    const s2 = await addSeat(pool, a.orgId, room, "R1", 2);
    const s3 = await addSeat(pool, a.orgId, room, "R1", 3);
    const dev = await mkGroup(a.scope, "Dev");
    const ops = await mkGroup(a.scope, "Ops");
    const m = await addMember(pool, a.orgId);
    await pool.query("update members set group_id = $2 where id = $1", [m, dev]);
    await setSeatTags(pool, a.scope, actor(), s1, { groupId: dev });
    await setSeatTags(pool, a.scope, actor(), s2, { groupId: dev });
    await setSeatTags(pool, a.scope, actor(), s3, { groupId: ops });
    expect(await getGroupImpact(pool, a.scope, dev)).toEqual({
      ok: true,
      value: { seats: 2, members: 1 },
    });
    expect(await deleteGroup(pool, a.scope, actor(), dev, true)).toEqual({ ok: true, value: null });
    expect((await seatRow(s1)).group_id).toBeNull();
    expect((await seatRow(s2)).group_id).toBeNull();
    expect((await seatRow(s3)).group_id).toBe(ops);
    expect(
      (await pool.query("select group_id from members where id = $1", [m])).rows[0].group_id,
    ).toBeNull();
    expect((await listGroups(pool, a.scope)).map((g) => g.id)).toEqual([ops]);
    expect(await auditCount(a.orgId, "group.delete")).toBe(1);
  });

  it("project delete: refuse, then force clears seats", async () => {
    const a = newOrg();
    const room = await addRoom(pool, a.orgId, "R1");
    const seat = await addSeat(pool, a.orgId, room, "R1", 1);
    const pid = await mkProject(a.scope, "ALPHA");
    await setSeatTags(pool, a.scope, actor(), seat, { projectId: pid });
    expect(await getProjectImpact(pool, a.scope, pid)).toEqual({ ok: true, value: { seats: 1 } });
    expect(await deleteProject(pool, a.scope, actor(), pid, false)).toEqual({
      ok: false,
      status: 409,
      code: "in_use",
    });
    expect((await deleteProject(pool, a.scope, actor(), pid, true)).ok).toBe(true);
    expect((await seatRow(seat)).project_id).toBeNull();
  });

  it("cross-org ids -> not_found", async () => {
    const a = newOrg();
    const b = newOrg();
    const gid = await mkGroup(b.scope, "Dev");
    const pid = await mkProject(b.scope, "ALPHA");
    const nf = { ok: false, status: 404, code: "not_found" };
    expect(await updateGroup(pool, a.scope, actor(), gid, { name: "x" })).toEqual(nf);
    expect(await getGroupImpact(pool, a.scope, gid)).toEqual(nf);
    expect(await deleteGroup(pool, a.scope, actor(), gid, true)).toEqual(nf);
    expect(await getProjectImpact(pool, a.scope, pid)).toEqual(nf);
    expect(await deleteProject(pool, a.scope, actor(), pid, true)).toEqual(nf);
    expect(await listGroups(pool, b.scope)).toHaveLength(1);
  });

  it("seat tags: set, clear, no-op writes no audit, foreign-org id refused", async () => {
    const a = newOrg();
    const b = newOrg();
    const room = await addRoom(pool, a.orgId, "R1");
    const seat = await addSeat(pool, a.orgId, room, "R1", 1);
    const gid = await mkGroup(a.scope, "Dev");
    const pid = await mkProject(a.scope, "ALPHA");
    const foreignG = await mkGroup(b.scope, "Dev");
    const foreignP = await mkProject(b.scope, "ALPHA");

    const set = await setSeatTags(pool, a.scope, actor(), seat, { groupId: gid, projectId: pid });
    expect(set.ok && set.value.group?.id).toBe(gid);
    expect(set.ok && set.value.project?.id).toBe(pid);
    expect(await auditCount(a.orgId, "seat.tags")).toBe(1);

    expect((await setSeatTags(pool, a.scope, actor(), seat, { groupId: gid })).ok).toBe(true);
    expect(await auditCount(a.orgId, "seat.tags")).toBe(1);

    const cleared = await setSeatTags(pool, a.scope, actor(), seat, { groupId: null });
    expect(cleared.ok && cleared.value.group).toBeNull();
    expect(cleared.ok && cleared.value.project?.id).toBe(pid);

    expect(await setSeatTags(pool, a.scope, actor(), seat, { groupId: foreignG })).toEqual({
      ok: false,
      status: 422,
      code: "invalid_group",
    });
    expect(await setSeatTags(pool, a.scope, actor(), seat, { projectId: foreignP })).toEqual({
      ok: false,
      status: 422,
      code: "invalid_project",
    });
    expect(await setSeatTags(pool, a.scope, actor(), randomUUID(), { groupId: null })).toEqual({
      ok: false,
      status: 404,
      code: "not_found",
    });
    expect((await seatRow(seat)).project_id).toBe(pid);
  });

  it.each([
    ["group", "groups"],
    ["project", "projects"],
  ] as const)(
    "tag write with unchanged %s does not wait on a forced delete's lock",
    async (kind, table) => {
      const a = newOrg();
      const room = await addRoom(pool, a.orgId, "R1");
      const seat = await addSeat(pool, a.orgId, room, "R1", 1);
      const gid = await mkGroup(a.scope, "Dev");
      const g2 = await mkGroup(a.scope, "Ops");
      const pid = await mkProject(a.scope, "ALPHA");
      const p2 = await mkProject(a.scope, "BETA");
      await setSeatTags(pool, a.scope, actor(), seat, { groupId: gid, projectId: pid });

      // What deleteGroup / deleteProject hold while they go on to lock the seat.
      const holder = await pool.connect();
      let write: Promise<unknown> | undefined;
      try {
        await holder.query("begin");
        await holder.query(`select id from ${table} where id = $1 for update`, [
          kind === "group" ? gid : pid,
        ]);
        write = setSeatTags(
          pool,
          a.scope,
          actor(),
          seat,
          kind === "group" ? { groupId: gid, projectId: p2 } : { groupId: g2, projectId: pid },
        );
        const timedOut = Symbol("timeout");
        let timer: NodeJS.Timeout | undefined;
        const first = await Promise.race([
          write,
          new Promise((resolve) => {
            timer = setTimeout(() => resolve(timedOut), 3000);
          }),
        ]);
        clearTimeout(timer);
        expect(first).not.toBe(timedOut);
      } finally {
        await holder.query("rollback");
        holder.release();
        await write;
      }
      const row = await seatRow(seat);
      expect(row.group_id).toBe(kind === "group" ? gid : g2);
      expect(row.project_id).toBe(kind === "group" ? p2 : pid);
    },
    15000,
  );

  it("changing to a different group still checks it", async () => {
    const a = newOrg();
    const room = await addRoom(pool, a.orgId, "R1");
    const seat = await addSeat(pool, a.orgId, room, "R1", 1);
    const gid = await mkGroup(a.scope, "Dev");
    await setSeatTags(pool, a.scope, actor(), seat, { groupId: gid });
    expect(await setSeatTags(pool, a.scope, actor(), seat, { groupId: randomUUID() })).toEqual({
      ok: false,
      status: 422,
      code: "invalid_group",
    });
  });
});
