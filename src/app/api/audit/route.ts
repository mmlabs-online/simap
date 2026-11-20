import { parseAuditQuery } from "@/lib/validate/audit-query";
import { listAudit } from "@/server/audit/audit";
import { getPool } from "@/server/db/pool";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export const GET = withAuth(
  async (req, ctx) => {
    const q = parseAuditQuery(new URL(req.url).searchParams);
    if (!q.ok) return apiError(400, "invalid_request");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    return Response.json(await listAudit(pool, ctx.scope, q.value), { headers: NO_STORE });
  },
  { tier: "admin" },
);
