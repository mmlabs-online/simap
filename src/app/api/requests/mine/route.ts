import { parseMyRequestsQuery } from "@/lib/validate/request-query";
import { getPool } from "@/server/db/pool";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";
import { listMyRequests } from "@/server/requests/read";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export const GET = withAuth(
  async (req, ctx) => {
    const q = parseMyRequestsQuery(new URL(req.url).searchParams);
    if (!q.ok) return apiError(400, "invalid_request");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    return Response.json(await listMyRequests(pool, ctx.scope, ctx.sub, q.value), {
      headers: NO_STORE,
    });
  },
  { tier: "user" },
);
