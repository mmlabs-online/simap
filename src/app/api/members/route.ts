import { parseMemberQuery } from "@/lib/validate/member-query";
import { getPool } from "@/server/db/pool";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";
import { listMembers } from "@/server/members/manage";

export const dynamic = "force-dynamic";

export const GET = withAuth(
  async (req, ctx) => {
    const q = parseMemberQuery(new URL(req.url).searchParams);
    if (!q.ok) return apiError(400, "invalid_request");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const page = await listMembers(pool, ctx.scope, q.value);
    return Response.json(page, { headers: { "Cache-Control": "no-store" } });
  },
  { tier: "user" },
);
