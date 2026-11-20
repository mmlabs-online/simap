import { isCanonicalUuid } from "@/lib/validate/uuid";
import { validateRoomPatch } from "@/lib/validate/room";
import { getPool } from "@/server/db/pool";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";
import { readJson } from "@/server/request/read-json";
import { deleteRoom, updateRoom } from "@/server/rooms/rooms";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export const PATCH = withAuth<{ id: string }>(
  async (req, ctx, route) => {
    const { id } = await route.params;
    if (!isCanonicalUuid(id)) return apiError(404, "not_found");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const body = await readJson(req);
    if (!body.ok) return apiError(400, "invalid_request");
    const v = validateRoomPatch(body.body);
    if (!v.ok) return apiError(400, "invalid_request");
    const r = await updateRoom(pool, ctx.scope, ctx.sub, id, v.value);
    if (!r.ok) return apiError(r.status, r.code);
    return Response.json(r.value, { headers: NO_STORE });
  },
  { tier: "admin" },
);

export const DELETE = withAuth<{ id: string }>(
  async (req, ctx, route) => {
    const { id } = await route.params;
    if (!isCanonicalUuid(id)) return apiError(404, "not_found");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const force = new URL(req.url).searchParams.get("force") === "true";
    const r = await deleteRoom(pool, ctx.scope, ctx.sub, id, force);
    if (!r.ok) return apiError(r.status, r.code);
    return new Response(null, { status: 204, headers: NO_STORE });
  },
  { tier: "admin" },
);
