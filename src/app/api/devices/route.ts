import { todayUtc7 } from "@/lib/devices/holding";
import { validateDeviceCreate, parseDeviceQuery } from "@/lib/validate/device";
import { createDevice, listDevices } from "@/server/devices/devices";
import { getPool } from "@/server/db/pool";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";
import { readJson } from "@/server/request/read-json";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export const GET = withAuth(
  async (req, ctx) => {
    const q = parseDeviceQuery(new URL(req.url).searchParams);
    if (!q.ok) return apiError(400, "invalid_request");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const r = await listDevices(pool, ctx.scope, ctx.sub, ctx.tier, q.value, todayUtc7(new Date()));
    if (!r.ok) return apiError(r.status, r.code);
    return Response.json(r.value, { headers: NO_STORE });
  },
  { tier: "user" },
);

export const POST = withAuth(
  async (req, ctx) => {
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const body = await readJson(req);
    if (!body.ok) return apiError(400, "invalid_request");
    const v = validateDeviceCreate(body.body);
    if (!v.ok) return apiError(400, "invalid_request");
    const r = await createDevice(pool, ctx.scope, ctx.sub, ctx.tier, v.value);
    if (!r.ok) return apiError(r.status, r.code);
    return Response.json(r.value, { status: 201, headers: NO_STORE });
  },
  { tier: "user" },
);
