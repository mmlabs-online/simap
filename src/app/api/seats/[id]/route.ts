import { isCanonicalUuid } from "@/lib/validate/uuid";
import { getPool } from "@/server/db/pool";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";
import { deleteSeat, getSeat } from "@/server/seats/seats";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export const GET = withAuth<{ id: string }>(
  async (_req, ctx, route) => {
    const { id } = await route.params;
    if (!isCanonicalUuid(id)) return apiError(404, "not_found");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const r = await getSeat(pool, ctx.scope, ctx.sub, ctx.tier, id);
    if (!r.ok) return apiError(r.status, r.code);
    return Response.json(r.value, { headers: NO_STORE });
  },
  { tier: "user" },
);

export const DELETE = withAuth<{ id: string }>(
  async (_req, ctx, route) => {
    const { id } = await route.params;
    if (!isCanonicalUuid(id)) return apiError(404, "not_found");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const r = await deleteSeat(pool, ctx.scope, ctx.sub, id);
    if (!r.ok) return apiError(r.status, r.code);
    return new Response(null, { status: 204, headers: NO_STORE });
  },
  { tier: "admin" },
);
