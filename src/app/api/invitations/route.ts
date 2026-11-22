import { canInviteRole } from "@/lib/invitations/roles";
import { validateInvitationRecord } from "@/lib/validate/invitation";
import { getPool } from "@/server/db/pool";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";
import { recordInvitation } from "@/server/invitations/record";
import { readJson } from "@/server/request/read-json";

export const dynamic = "force-dynamic";

/** Records an invitation the browser already sent through Identity. Every refusal comes before the write (R7). */
export const POST = withAuth(
  async (req, ctx) => {
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const body = await readJson(req);
    if (!body.ok) return apiError(400, "invalid_request");
    const v = validateInvitationRecord(body.body, Date.now());
    if (!v.ok) return apiError(400, "invalid_request");
    if (!canInviteRole(ctx.tier, v.value.role)) return apiError(422, "role_not_allowed");
    const dto = await recordInvitation(pool, ctx.scope, ctx.sub, v.value);
    return Response.json(dto, { status: 201, headers: { "Cache-Control": "no-store" } });
  },
  { tier: "manager" },
);
