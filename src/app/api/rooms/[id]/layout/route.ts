import { LAYOUT_LIMITS, validateLayoutSave } from "@/lib/validate/layout";
import { isCanonicalUuid } from "@/lib/validate/uuid";
import { getPool } from "@/server/db/pool";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";
import { getRoomLayout } from "@/server/layout/layout";
import { saveRoomLayout } from "@/server/layout/save";
import { readJson } from "@/server/request/read-json";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export const GET = withAuth<{ id: string }>(
  async (_req, ctx, route) => {
    const { id } = await route.params;
    if (!isCanonicalUuid(id)) return apiError(404, "not_found");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const r = await getRoomLayout(pool, ctx.scope, ctx.sub, id);
    if (!r.ok) return apiError(r.status, r.code);
    return Response.json(r.value, { headers: NO_STORE });
  },
  { tier: "user" },
);

export const PUT = withAuth<{ id: string }>(
  async (req, ctx, route) => {
    const { id } = await route.params;
    if (!isCanonicalUuid(id)) return apiError(404, "not_found");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const body = await readJson(req, LAYOUT_LIMITS.bodyBytes);
    if (!body.ok) return apiError(400, "invalid_request");
    const v = validateLayoutSave(body.body);
    if (!v.ok) return apiError(v.code === "invalid_request" ? 400 : 422, v.code);
    const r = await saveRoomLayout(pool, ctx.scope, ctx.sub, id, v.value);
    if (!r.ok) return apiError(r.status, r.code);
    return Response.json(r.value, { headers: NO_STORE });
  },
  { tier: "admin" },
);
