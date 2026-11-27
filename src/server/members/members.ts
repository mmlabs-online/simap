import "server-only";
import type { MeMemberDto, MemberStatus } from "@/lib/members/types";
import { defaultDisplayName } from "@/lib/validate/member";
import { writeAudit } from "@/server/audit/write";
import { withTx, type TxClient, type TxPool } from "@/server/db/tx";
import { orgQuery, type OrgScope } from "@/server/http/org-scope";

type Query = { query(text: string, values: unknown[]): Promise<{ rows: any[] }> };
export type Db = TxPool & Query;

export type Refusal = { ok: false; status: 403; code: "forbidden" | "member_deactivated" };
export type Result<T> = { ok: true; value: T } | Refusal;

const forbidden: Refusal = { ok: false, status: 403, code: "forbidden" };
const deactivated: Refusal = { ok: false, status: 403, code: "member_deactivated" };

type Who = { sub: string; email: string | null };

type Row = {
  id: string;
  display_name: string;
  status: MemberStatus;
  profile_confirmed_at: Date | null;
};

const COLS = "id, display_name, status, profile_confirmed_at";

const toDto = (r: Row): MeMemberDto => ({
  id: r.id,
  displayName: r.display_name,
  status: r.status,
  needsProfile: r.profile_confirmed_at === null,
});

async function find(
  db: Query,
  scope: OrgScope,
  sub: string,
  lock = false,
): Promise<Row | undefined> {
  const { rows } = await orgQuery<Row>(
    db,
    scope,
    `select ${COLS} from members where org_id = $1 and sub = $2${lock ? " for update" : ""}`,
    [sub],
  );
  return rows[0];
}

/** Insert on first visit (one winner under concurrency, one audit row), then read the row back. */
async function ensure(c: TxClient, scope: OrgScope, who: Who): Promise<Row | null> {
  const existing = await find(c, scope, who.sub);
  if (existing) return existing;
  if (!who.email?.trim()) return null;
  // The select-from-subselect form satisfies orgQuery's org_id = $1 guard; org_id is always the scope org.
  const { rows } = await orgQuery<{ id: string }>(
    c,
    scope,
    `insert into members (org_id, sub, email, display_name)
     select o.org_id, $2::uuid, $3::text, $4::text
     from (select $1::uuid as org_id) o where o.org_id = $1::uuid
     on conflict (org_id, sub) do nothing returning id`,
    [who.sub, who.email, defaultDisplayName(who.email)],
  );
  if (rows[0]) {
    await writeAudit(c, scope, {
      actorSub: who.sub,
      action: "member.create",
      entity: "member",
      entityId: rows[0].id,
      meta: { source: "first_visit" },
    });
  }
  return (await find(c, scope, who.sub)) ?? null;
}

export async function getOrCreateMember(
  db: Db,
  scope: OrgScope,
  who: Who,
): Promise<Result<MeMemberDto>> {
  const existing = await find(db, scope, who.sub);
  if (existing) return { ok: true, value: toDto(existing) };
  if (!who.email?.trim()) return forbidden;
  const row = await withTx(db, (c) => ensure(c, scope, who));
  return row ? { ok: true, value: toDto(row) } : forbidden;
}

/** Read-only: the caller's own row or null; never inserts (D86 super admins have no row). */
export async function getMember(db: Db, scope: OrgScope, sub: string): Promise<MeMemberDto | null> {
  const row = await find(db, scope, sub);
  return row ? toDto(row) : null;
}

export function setOwnDisplayName(
  db: Db,
  scope: OrgScope,
  who: Who,
  displayName: string,
): Promise<Result<MeMemberDto>> {
  return withTx(db, async (c): Promise<Result<MeMemberDto>> => {
    if (!(await ensure(c, scope, who))) return forbidden;
    const row = (await find(c, scope, who.sub, true))!;
    if (row.status === "deactivated") return deactivated;
    const { rows } = await orgQuery<Row>(
      c,
      scope,
      `update members
       set display_name = $3, profile_confirmed_at = coalesce(profile_confirmed_at, now()), updated_at = now()
       where org_id = $1 and sub = $2 and (display_name is distinct from $3 or profile_confirmed_at is null)
       returning ${COLS}`,
      [who.sub, displayName],
    );
    if (!rows[0]) return { ok: true, value: toDto(row) };
    await writeAudit(c, scope, {
      actorSub: who.sub,
      action: "member.update",
      entity: "member",
      entityId: rows[0].id,
      meta: { fields: ["displayName"], self: true },
    });
    return { ok: true, value: toDto(rows[0]) };
  });
}
