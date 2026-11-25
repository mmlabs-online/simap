import { listMapItems } from "@/server/map-items/map-items";
import { getPool } from "@/server/db/pool";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export const GET = withAuth(
  async (_req, ctx) => {
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const r = await listMapItems(pool, ctx.scope, { includeHidden: ctx.tier === "admin" });
    return Response.json(r.value, { headers: NO_STORE });
  },
  { tier: "user" },
);
