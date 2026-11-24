import { parseSearchQuery } from "@/lib/validate/search-query";
import { getPool } from "@/server/db/pool";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";
import { search } from "@/server/search/search";

export const dynamic = "force-dynamic";

export const GET = withAuth(
  async (req, ctx) => {
    const q = parseSearchQuery(new URL(req.url).searchParams);
    if (!q.ok) return apiError(400, "invalid_request");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const body = await search(pool, ctx.scope, q.value);
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  },
  { tier: "user" },
);
