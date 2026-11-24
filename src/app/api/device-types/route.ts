import { DEVICE_TYPE_LIMITS } from "@/lib/device-types/types";
import { validateDeviceTypeCreate } from "@/lib/validate/device-type";
import { createDeviceType, listDeviceTypes } from "@/server/device-types/device-types";
import { getPool } from "@/server/db/pool";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";
import { readJson } from "@/server/request/read-json";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export const GET = withAuth(
  async (_req, ctx) => {
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const r = await listDeviceTypes(pool, ctx.scope);
    if (!r.ok) return apiError(r.status, r.code);
    return Response.json(r.value, { headers: NO_STORE });
  },
  { tier: "user" },
);

export const POST = withAuth(
  async (req, ctx) => {
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const body = await readJson(req, DEVICE_TYPE_LIMITS.bodyBytes);
    if (!body.ok) return apiError(400, "invalid_request");
    const v = validateDeviceTypeCreate(body.body);
    if (!v.ok) return apiError(400, "invalid_request");
    const r = await createDeviceType(pool, ctx.scope, ctx.sub, v.value);
    if (!r.ok) return apiError(r.status, r.code);
    return Response.json(r.value, { status: 201, headers: NO_STORE });
  },
  { tier: "admin" },
);
