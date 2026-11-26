import { isCanonicalUuid } from "@/lib/validate/uuid";
import { validateSeatAdd } from "@/lib/validate/seat";
import { getPool } from "@/server/db/pool";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";
import { readJson } from "@/server/request/read-json";
import { addSeats, listRoomSeats } from "@/server/seats/seats";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export const GET = withAuth<{ id: string }>(
  async (_req, ctx, route) => {
    const { id } = await route.params;
    if (!isCanonicalUuid(id)) return apiError(404, "not_found");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const r = await listRoomSeats(pool, ctx.scope, ctx.sub, ctx.tier, id);
    if (!r.ok) return apiError(r.status, r.code);
    return Response.json(r.value, { headers: NO_STORE });
  },
  { tier: "user" },
);

export const POST = withAuth<{ id: string }>(
  async (req, ctx, route) => {
    const { id } = await route.params;
    if (!isCanonicalUuid(id)) return apiError(404, "not_found");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const body = await readJson(req);
    if (!body.ok) return apiError(400, "invalid_request");
    const v = validateSeatAdd(body.body);
    if (!v.ok) return apiError(400, "invalid_request");
    const r = await addSeats(pool, ctx.scope, ctx.sub, id, v.value.count);
    if (!r.ok) return apiError(r.status, r.code);
    return Response.json({ items: r.value }, { status: 201, headers: NO_STORE });
  },
  { tier: "admin" },
);
