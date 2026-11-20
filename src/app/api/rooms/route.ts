import { validateRoomCreate } from "@/lib/validate/room";
import { getPool } from "@/server/db/pool";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";
import { readJson } from "@/server/request/read-json";
import { createRoom, listRooms } from "@/server/rooms/rooms";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export const GET = withAuth(
  async (_req, ctx) => {
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const rooms = await listRooms(pool, ctx.scope);
    return Response.json({ rooms }, { headers: NO_STORE });
  },
  { tier: "user" },
);

export const POST = withAuth(
  async (req, ctx) => {
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const body = await readJson(req);
    if (!body.ok) return apiError(400, "invalid_request");
    const v = validateRoomCreate(body.body);
    if (!v.ok) return apiError(400, "invalid_request");
    const r = await createRoom(pool, ctx.scope, ctx.sub, v.value);
    if (!r.ok) return apiError(r.status, r.code);
    return Response.json(r.value, { status: 201, headers: NO_STORE });
  },
  { tier: "admin" },
);
