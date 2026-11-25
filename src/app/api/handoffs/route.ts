import { validateHandoffBox } from "@/lib/validate/device";
import { listHandoffs } from "@/server/devices/handoffs";
import { getPool } from "@/server/db/pool";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";

export const dynamic = "force-dynamic";

export const GET = withAuth(
  async (req, ctx) => {
    const box = validateHandoffBox(new URL(req.url).searchParams);
    if (!box.ok) return apiError(400, "invalid_request");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const r = await listHandoffs(pool, ctx.scope, ctx.sub, ctx.tier);
    if (!r.ok) return apiError(r.status, r.code);
    return Response.json(r.value, { headers: { "Cache-Control": "no-store" } });
  },
  { tier: "user" },
);
