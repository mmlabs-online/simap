import { todayUtc7 } from "@/lib/devices/holding";
import { parseMyDevicesQuery } from "@/lib/validate/my-devices-query";
import { getPool } from "@/server/db/pool";
import { listMyDevices } from "@/server/devices/devices";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export const GET = withAuth(
  async (req, ctx) => {
    const q = parseMyDevicesQuery(new URL(req.url).searchParams);
    if (!q.ok) return apiError(400, "invalid_request");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const page = await listMyDevices(
      pool,
      ctx.scope,
      ctx.sub,
      ctx.tier,
      q.value,
      todayUtc7(new Date()),
    );
    return Response.json(page, { headers: NO_STORE });
  },
  { tier: "user" },
);
