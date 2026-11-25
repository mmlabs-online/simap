import { isCanonicalUuid } from "@/lib/validate/uuid";
import { takeBack } from "@/server/devices/handoffs";
import { getPool } from "@/server/db/pool";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";

export const dynamic = "force-dynamic";

export const POST = withAuth<{ id: string }>(
  async (_req, ctx, route) => {
    const { id } = await route.params;
    if (!isCanonicalUuid(id)) return apiError(404, "not_found");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const r = await takeBack(pool, ctx.scope, ctx.sub, ctx.tier, id);
    if (!r.ok) return apiError(r.status, r.code);
    return Response.json(r.value, { headers: { "Cache-Control": "no-store" } });
  },
  { tier: "admin" },
);
