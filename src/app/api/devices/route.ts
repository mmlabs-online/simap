import { parseDeviceQuery } from "@/lib/validate/device";
import { listDevices } from "@/server/devices/devices";
import { getPool } from "@/server/db/pool";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";

export const dynamic = "force-dynamic";

export const GET = withAuth(
  async (req, ctx) => {
    const q = parseDeviceQuery(new URL(req.url).searchParams);
    if (!q.ok) return apiError(400, "invalid_request");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const r = await listDevices(pool, ctx.scope, ctx.sub, ctx.tier, q.value);
    if (!r.ok) return apiError(r.status, r.code);
    return Response.json(r.value, { headers: { "Cache-Control": "no-store" } });
  },
  { tier: "user" },
);
