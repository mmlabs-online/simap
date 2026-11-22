import { getPool } from "@/server/db/pool";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";
import { listPendingInvitations } from "@/server/members/manage";

export const dynamic = "force-dynamic";

export const GET = withAuth(
  async (_req, ctx) => {
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const items = await listPendingInvitations(pool, ctx.scope);
    return Response.json({ items }, { headers: { "Cache-Control": "no-store" } });
  },
  { tier: "manager" },
);
