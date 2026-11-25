import { todayUtc7 } from "@/lib/devices/holding";
import { isCanonicalUuid } from "@/lib/validate/uuid";
import { validateHoldingPatch } from "@/lib/validate/device";
import { updateHolding } from "@/server/devices/devices";
import { getPool } from "@/server/db/pool";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";
import { readJson } from "@/server/request/read-json";

export const dynamic = "force-dynamic";

export const PATCH = withAuth<{ id: string }>(
  async (req, ctx, route) => {
    const { id } = await route.params;
    if (!isCanonicalUuid(id)) return apiError(404, "not_found");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const body = await readJson(req);
    if (!body.ok) return apiError(400, "invalid_request");
    const v = validateHoldingPatch(body.body, todayUtc7(new Date()));
    if (!v.ok) return apiError(400, "invalid_request");
    const r = await updateHolding(pool, ctx.scope, ctx.sub, ctx.tier, id, v.value);
    if (!r.ok) return apiError(r.status, r.code);
    return Response.json(r.value, { headers: { "Cache-Control": "no-store" } });
  },
  { tier: "user" },
);
