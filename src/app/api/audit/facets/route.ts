import { listAuditFacets } from "@/server/audit/audit";
import { getPool } from "@/server/db/pool";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export const GET = withAuth(
  async (_req, ctx) => {
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    return Response.json(await listAuditFacets(pool, ctx.scope), { headers: NO_STORE });
  },
  { tier: "admin" },
);
