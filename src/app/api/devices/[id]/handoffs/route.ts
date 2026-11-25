import { isCanonicalUuid } from "@/lib/validate/uuid";
import { validateHandoffStart } from "@/lib/validate/device";
import { startTransfer } from "@/server/devices/handoffs";
import { getPool } from "@/server/db/pool";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";
import { readJson } from "@/server/request/read-json";

export const dynamic = "force-dynamic";

export const POST = withAuth<{ id: string }>(
  async (req, ctx, route) => {
    const { id } = await route.params;
    if (!isCanonicalUuid(id)) return apiError(404, "not_found");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const body = await readJson(req);
    if (!body.ok) return apiError(400, "invalid_request");
    const v = validateHandoffStart(body.body);
    if (!v.ok) return apiError(400, "invalid_request");
    const r = await startTransfer(pool, ctx.scope, ctx.sub, ctx.tier, id, v.value);
    if (!r.ok) return apiError(r.status, r.code);
    return Response.json(r.value, { status: 201, headers: { "Cache-Control": "no-store" } });
  },
  { tier: "user" },
);
