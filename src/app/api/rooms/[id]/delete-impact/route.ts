import { isCanonicalUuid } from "@/lib/validate/uuid";
import { getPool } from "@/server/db/pool";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";
import { getDeleteImpact } from "@/server/rooms/rooms";

export const dynamic = "force-dynamic";

export const GET = withAuth<{ id: string }>(
  async (_req, ctx, route) => {
    const { id } = await route.params;
    if (!isCanonicalUuid(id)) return apiError(404, "not_found");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const r = await getDeleteImpact(pool, ctx.scope, id);
    if (!r.ok) return apiError(r.status, r.code);
    return Response.json(r.value, { headers: { "Cache-Control": "no-store" } });
  },
  { tier: "admin" },
);
