import { parseRequestListQuery } from "@/lib/validate/request-query";
import { validateRequestCreate } from "@/lib/validate/request";
import { getPool } from "@/server/db/pool";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";
import { readJson } from "@/server/request/read-json";
import { listRequests } from "@/server/requests/read";
import { createRequest } from "@/server/requests/requests";

export const dynamic = "force-dynamic";

export const POST = withAuth(
  async (req, ctx) => {
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const body = await readJson(req);
    if (!body.ok) return apiError(400, "invalid_request");
    const v = validateRequestCreate(body.body);
    if (!v.ok) return apiError(400, "invalid_request");
    const r = await createRequest(pool, ctx.scope, ctx.sub, v.value.seatId);
    if (!r.ok) return apiError(r.status, r.code);
    return Response.json(r.value.request, {
      status: r.value.created ? 201 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  },
  { tier: "user" },
);

export const GET = withAuth(
  async (req, ctx) => {
    const q = parseRequestListQuery(new URL(req.url).searchParams);
    if (!q.ok) return apiError(400, "invalid_request");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    return Response.json(await listRequests(pool, ctx.scope, q.value), {
      headers: { "Cache-Control": "no-store" },
    });
  },
  { tier: "manager" },
);
