import "server-only";
import { parsePixelLook, type PixelLook } from "@/lib/sprites/pixel-look";
import { writeAudit } from "@/server/audit/write";
import { withTx } from "@/server/db/tx";
import { orgQuery, type OrgScope } from "@/server/http/org-scope";
import type { Db } from "./members";

export type LookResult =
  | { ok: true; value: PixelLook | null }
  | { ok: false; status: 404; code: "not_found" }
  | { ok: false; status: 403; code: "member_deactivated" };

const notFound = { ok: false, status: 404, code: "not_found" } as const;
const deactivated = { ok: false, status: 403, code: "member_deactivated" } as const;

/** The caller's own stored look (null = derived). No member row is a 404; nothing is created here. */
export async function getOwnPixelLook(db: Db, scope: OrgScope, sub: string): Promise<LookResult> {
  const { rows } = await orgQuery<{ pixel_look: unknown }>(
    db,
    scope,
    "select pixel_look from members where org_id = $1 and sub = $2",
    [sub],
  );
  return rows[0] ? { ok: true, value: parsePixelLook(rows[0].pixel_look) } : notFound;
}

/** Sets (or, with null, resets) the caller's own look; one audit row only when the value changes. */
export function setOwnPixelLook(
  db: Db,
  scope: OrgScope,
  sub: string,
  look: PixelLook | null,
): Promise<LookResult> {
  return withTx(db, async (c): Promise<LookResult> => {
    const { rows: found } = await orgQuery<{ id: string; status: string }>(
      c,
      scope,
      "select id, status from members where org_id = $1 and sub = $2 for update",
      [sub],
    );
    const me = found[0];
    if (!me) return notFound;
    if (me.status === "deactivated") return deactivated;
    const { rows } = await orgQuery<{ id: string }>(
      c,
      scope,
      `update members set pixel_look = $3::jsonb, updated_at = now()
       where org_id = $1 and sub = $2 and pixel_look is distinct from $3::jsonb returning id`,
      [sub, look === null ? null : JSON.stringify(look)],
    );
    if (rows[0]) {
      await writeAudit(c, scope, {
        actorSub: sub,
        action: "member.update",
        entity: "member",
        entityId: me.id,
        meta: { fields: ["pixelLook"], self: true, look },
      });
    }
    return { ok: true, value: look };
  });
}
