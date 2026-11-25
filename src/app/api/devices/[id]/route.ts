import { todayUtc7 } from "@/lib/devices/holding";
import { isCanonicalUuid } from "@/lib/validate/uuid";
import { validateDevicePatch } from "@/lib/validate/device";
import { deleteDevice, getDevice, updateDevice } from "@/server/devices/devices";
import { getPool } from "@/server/db/pool";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";
import { readJson } from "@/server/request/read-json";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export const GET = withAuth<{ id: string }>(
  async (_req, ctx, route) => {
    const { id } = await route.params;
    if (!isCanonicalUuid(id)) return apiError(404, "not_found");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const r = await getDevice(pool, ctx.scope, ctx.sub, ctx.tier, id, todayUtc7(new Date()));
    if (!r.ok) return apiError(r.status, r.code);
    return Response.json(r.value, { headers: NO_STORE });
  },
  { tier: "user" },
);

export const PATCH = withAuth<{ id: string }>(
  async (req, ctx, route) => {
    const { id } = await route.params;
    if (!isCanonicalUuid(id)) return apiError(404, "not_found");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const body = await readJson(req);
    if (!body.ok) return apiError(400, "invalid_request");
    const v = validateDevicePatch(body.body);
    if (!v.ok) return apiError(400, "invalid_request");
    const r = await updateDevice(pool, ctx.scope, ctx.sub, ctx.tier, id, v.value);
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
    const r = await deleteDevice(pool, ctx.scope, ctx.sub, ctx.tier, id);
    if (!r.ok) return apiError(r.status, r.code);
    return new Response(null, { status: 204, headers: NO_STORE });
  },
  { tier: "user" },
);
