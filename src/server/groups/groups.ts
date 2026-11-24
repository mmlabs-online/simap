import "server-only";
import { decideDelete } from "@/lib/groups/delete-impact";
import type { GroupDto, GroupImpact, ProjectDto, ProjectImpact } from "@/lib/groups/types";
import type {
  GroupCreateValue,
  GroupPatchValue,
  ProjectCreateValue,
  ProjectPatchValue,
} from "@/lib/validate/group";
import { writeAudit } from "@/server/audit/write";
import { withTx, type TxClient, type TxPool } from "@/server/db/tx";
import { orgQuery, type OrgScope } from "@/server/http/org-scope";
import { groupConflict } from "./pg-error";

type Query = { query(text: string, values: unknown[]): Promise<{ rows: any[] }> };
export type Db = TxPool & Query;

export type Refusal = {
  ok: false;
  status: 404 | 409;
  code: "not_found" | "group_name_taken" | "project_code_taken" | "in_use";
};
export type Result<T> = { ok: true; value: T } | Refusal;

const notFound: Refusal = { ok: false, status: 404, code: "not_found" };

/** Thrown inside a transaction to roll it back and answer with a domain refusal. */
class Abort extends Error {
  constructor(readonly refusal: Refusal) {
    super("abort");
  }
}

async function inTx<T>(pool: Db, fn: (c: TxClient) => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, value: await withTx(pool, fn) };
  } catch (err) {
    if (err instanceof Abort) return err.refusal;
    const code = groupConflict(err);
    if (code) return { ok: false, status: 409, code };
    throw err;
  }
}

// ---- groups ---------------------------------------------------------------------------------------------------

export async function listGroups(db: Query, scope: OrgScope): Promise<GroupDto[]> {
  const { rows } = await orgQuery<GroupDto>(
    db,
    scope,
    "select id, name, color from groups where org_id = $1 order by lower(name), id limit 500",
  );
  return rows;
}

async function loadGroup(db: Query, scope: OrgScope, id: string): Promise<GroupDto> {
  const { rows } = await orgQuery<GroupDto>(
    db,
    scope,
    "select id, name, color from groups where org_id = $1 and id = $2",
    [id],
  );
  return rows[0]!;
}

export function createGroup(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  v: GroupCreateValue,
): Promise<Result<GroupDto>> {
  return inTx(db, async (c) => {
    // The select-from-subselect form satisfies orgQuery's org_id = $1 guard; org_id is always the scope org.
    const { rows } = await orgQuery<{ id: string }>(
      c,
      scope,
      `insert into groups (org_id, name, color)
       select o.org_id, $2::text, $3::text
       from (select $1::uuid as org_id) o where o.org_id = $1::uuid returning id`,
      [v.name, v.color],
    );
    const id = rows[0]!.id;
    await writeAudit(c, scope, {
      actorSub,
      action: "group.create",
      entity: "group",
      entityId: id,
      meta: { name: v.name },
    });
    return loadGroup(c, scope, id);
  });
}

async function lockGroup(c: Query, scope: OrgScope, id: string): Promise<{ name: string }> {
  const { rows } = await orgQuery<{ name: string }>(
    c,
    scope,
    "select name from groups where org_id = $1 and id = $2 for update",
    [id],
  );
  if (!rows[0]) throw new Abort(notFound);
  return rows[0];
}

export function updateGroup(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  id: string,
  patch: GroupPatchValue,
): Promise<Result<GroupDto>> {
  return inTx(db, async (c) => {
    await lockGroup(c, scope, id);
    const fields = (["name", "color"] as const).filter((k) => patch[k] !== undefined);
    const sets = fields.map((k, i) => `${k} = $${i + 3}`);
    await orgQuery(
      c,
      scope,
      `update groups set ${sets.join(", ")}, updated_at = now() where org_id = $1 and id = $2`,
      [id, ...fields.map((k) => patch[k])],
    );
    await writeAudit(c, scope, {
      actorSub,
      action: "group.update",
      entity: "group",
      entityId: id,
      meta: { fields },
    });
    return loadGroup(c, scope, id);
  });
}

async function groupImpactOf(c: Query, scope: OrgScope, id: string): Promise<GroupImpact> {
  const { rows } = await orgQuery<GroupImpact>(
    c,
    scope,
    `select (select count(*)::int from seats where org_id = $1 and group_id = $2) as seats,
       (select count(*)::int from members where org_id = $1 and group_id = $2) as members`,
    [id],
  );
  return rows[0]!;
}

export async function getGroupImpact(
  db: Query,
  scope: OrgScope,
  id: string,
): Promise<Result<GroupImpact>> {
  const { rows } = await orgQuery(
    db,
    scope,
    "select id from groups where org_id = $1 and id = $2",
    [id],
  );
  if (!rows[0]) return notFound;
  return { ok: true, value: await groupImpactOf(db, scope, id) };
}

/**
 * Locks the group row (a tag write that newly sets this group holds it `for share`, so it commits first and is
 * counted, or waits and then fails its row check; a tag write that keeps an unchanged group takes no group
 * lock), then clears members before seats (a racing SIM-012 assign holds the member `for share` and copies its
 * group onto the seat), each in ascending id order. No room lock is taken, so it does not conflict with the
 * room -> seat lock order documented on deleteRoom. The SIM-012 assign vs delete race can still deadlock;
 * Postgres detects it (40P01) and one side fails with a 500.
 */
export function deleteGroup(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  id: string,
  force: boolean,
): Promise<Result<null>> {
  return inTx(db, async (c) => {
    const group = await lockGroup(c, scope, id);
    const impact = await groupImpactOf(c, scope, id);
    const decision = decideDelete(impact, force);
    if (decision === "refuse_in_use") throw new Abort({ ok: false, status: 409, code: "in_use" });
    if (decision === "clear_and_delete") {
      await orgQuery(
        c,
        scope,
        "select id from members where org_id = $1 and group_id = $2 order by id for update",
        [id],
      );
      await orgQuery(
        c,
        scope,
        "update members set group_id = null, updated_at = now() where org_id = $1 and group_id = $2",
        [id],
      );
      await orgQuery(
        c,
        scope,
        "select id from seats where org_id = $1 and group_id = $2 order by id for update",
        [id],
      );
      await orgQuery(
        c,
        scope,
        "update seats set group_id = null, updated_at = now() where org_id = $1 and group_id = $2",
        [id],
      );
    }
    await orgQuery(c, scope, "delete from groups where org_id = $1 and id = $2", [id]);
    await writeAudit(c, scope, {
      actorSub,
      action: "group.delete",
      entity: "group",
      entityId: id,
      meta: { name: group.name, seats: impact.seats, members: impact.members, forced: force },
    });
    return null;
  });
}

// ---- projects -------------------------------------------------------------------------------------------------

export async function listProjects(db: Query, scope: OrgScope): Promise<ProjectDto[]> {
  const { rows } = await orgQuery<ProjectDto>(
    db,
    scope,
    "select id, code, name from projects where org_id = $1 order by code, id limit 500",
  );
  return rows;
}

async function loadProject(db: Query, scope: OrgScope, id: string): Promise<ProjectDto> {
  const { rows } = await orgQuery<ProjectDto>(
    db,
    scope,
    "select id, code, name from projects where org_id = $1 and id = $2",
    [id],
  );
  return rows[0]!;
}

export function createProject(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  v: ProjectCreateValue,
): Promise<Result<ProjectDto>> {
  return inTx(db, async (c) => {
    const { rows } = await orgQuery<{ id: string }>(
      c,
      scope,
      `insert into projects (org_id, code, name)
       select o.org_id, $2::text, $3::text
       from (select $1::uuid as org_id) o where o.org_id = $1::uuid returning id`,
      [v.code, v.name],
    );
    const id = rows[0]!.id;
    await writeAudit(c, scope, {
      actorSub,
      action: "project.create",
      entity: "project",
      entityId: id,
      meta: { code: v.code },
    });
    return loadProject(c, scope, id);
  });
}

async function lockProject(c: Query, scope: OrgScope, id: string): Promise<{ code: string }> {
  const { rows } = await orgQuery<{ code: string }>(
    c,
    scope,
    "select code from projects where org_id = $1 and id = $2 for update",
    [id],
  );
  if (!rows[0]) throw new Abort(notFound);
  return rows[0];
}

export function updateProject(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  id: string,
  patch: ProjectPatchValue,
): Promise<Result<ProjectDto>> {
  return inTx(db, async (c) => {
    await lockProject(c, scope, id);
    const fields = (["code", "name"] as const).filter((k) => patch[k] !== undefined);
    const sets = fields.map((k, i) => `${k} = $${i + 3}`);
    await orgQuery(
      c,
      scope,
      `update projects set ${sets.join(", ")}, updated_at = now() where org_id = $1 and id = $2`,
      [id, ...fields.map((k) => patch[k])],
    );
    await writeAudit(c, scope, {
      actorSub,
      action: "project.update",
      entity: "project",
      entityId: id,
      meta: { fields },
    });
    return loadProject(c, scope, id);
  });
}

async function projectImpactOf(c: Query, scope: OrgScope, id: string): Promise<ProjectImpact> {
  const { rows } = await orgQuery<ProjectImpact>(
    c,
    scope,
    "select count(*)::int as seats from seats where org_id = $1 and project_id = $2",
    [id],
  );
  return rows[0]!;
}

export async function getProjectImpact(
  db: Query,
  scope: OrgScope,
  id: string,
): Promise<Result<ProjectImpact>> {
  const { rows } = await orgQuery(
    db,
    scope,
    "select id from projects where org_id = $1 and id = $2",
    [id],
  );
  if (!rows[0]) return notFound;
  return { ok: true, value: await projectImpactOf(db, scope, id) };
}

/** Same locking idea as deleteGroup: project row first, then its seats in ascending id order, no room lock. */
export function deleteProject(
  db: Db,
  scope: OrgScope,
  actorSub: string,
  id: string,
  force: boolean,
): Promise<Result<null>> {
  return inTx(db, async (c) => {
    const project = await lockProject(c, scope, id);
    const impact = await projectImpactOf(c, scope, id);
    const decision = decideDelete(impact, force);
    if (decision === "refuse_in_use") throw new Abort({ ok: false, status: 409, code: "in_use" });
    if (decision === "clear_and_delete") {
      await orgQuery(
        c,
        scope,
        "select id from seats where org_id = $1 and project_id = $2 order by id for update",
        [id],
      );
      await orgQuery(
        c,
        scope,
        "update seats set project_id = null, updated_at = now() where org_id = $1 and project_id = $2",
        [id],
      );
    }
    await orgQuery(c, scope, "delete from projects where org_id = $1 and id = $2", [id]);
    await writeAudit(c, scope, {
      actorSub,
      action: "project.delete",
      entity: "project",
      entityId: id,
      meta: { code: project.code, seats: impact.seats, forced: force },
    });
    return null;
  });
}
