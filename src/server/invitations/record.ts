import "server-only";
import type { PendingInvitationDto } from "@/lib/members/types";
import type { InvitationRecordValue } from "@/lib/validate/invitation";
import { writeAudit } from "@/server/audit/write";
import { withTx, type TxPool } from "@/server/db/tx";
import { orgQuery, type OrgScope } from "@/server/http/org-scope";

const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v));

/**
 * Records an invitation sent through Identity (no token, ever). One pending row per address: a re-invite
 * replaces role, inviter and expiry (Identity supersedes the earlier one too), so a repeated call is harmless.
 */
export async function recordInvitation(
  pool: TxPool,
  scope: OrgScope,
  actorSub: string,
  v: InvitationRecordValue,
): Promise<PendingInvitationDto> {
  return withTx(pool, async (c) => {
    // The select-from-subselect form satisfies orgQuery's org_id = $1 guard; org_id is always the scope org.
    const { rows } = await orgQuery<{
      id: string;
      email: string;
      role: string;
      created_at: Date | string;
      expires_at: Date | string | null;
    }>(
      c,
      scope,
      `insert into invitations (org_id, email, role, invited_by_sub, identity_invitation_id, expires_at)
       select o.org_id, $2::text, $3::text, $4::uuid, $5::text, $6::timestamptz
       from (select $1::uuid as org_id) o where o.org_id = $1::uuid
       on conflict (org_id, lower(email)) where status = 'pending'
       do update set role = excluded.role, invited_by_sub = excluded.invited_by_sub,
         identity_invitation_id = excluded.identity_invitation_id, expires_at = excluded.expires_at,
         created_at = now(), updated_at = now()
       returning id, email, role, created_at, expires_at`,
      [v.email, v.role, actorSub, v.identityInvitationId, v.expiresAt],
    );
    const row = rows[0]!;
    await writeAudit(c, scope, {
      actorSub,
      action: "invitation.create",
      entity: "invitation",
      entityId: row.id,
      meta: { role: v.role },
    });
    return {
      id: row.id,
      email: row.email,
      role: row.role,
      createdAt: iso(row.created_at),
      expiresAt: row.expires_at === null ? null : iso(row.expires_at),
    };
  });
}
