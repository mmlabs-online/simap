import { validateSeenBody } from "@/lib/validate/request";
import { getPool } from "@/server/db/pool";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";
import { readJson } from "@/server/request/read-json";
import { markRequestsSeen } from "@/server/requests/read";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export const POST = withAuth(
  async (req, ctx) => {
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const body = await readJson(req);
    if (!body.ok) return apiError(400, "invalid_request");
    const v = validateSeenBody(body.body);
    if (!v.ok) return apiError(400, "invalid_request");
    return Response.json(await markRequestsSeen(pool, ctx.scope, ctx.sub, v.value.seenUpTo), {
      headers: NO_STORE,
    });
  },
  { tier: "user" },
);
