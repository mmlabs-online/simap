import type { ApiErrorBody } from "@/lib/api/error";
import { validateCheckIn, validateMove } from "@/lib/validate/presence";
import { getPool } from "@/server/db/pool";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";
import { checkIn, checkOut, getMyPresence, moveSeat } from "@/server/presence/presence";
import { syncProviderCheckIns } from "@/server/presence/provider";
import { readJson } from "@/server/request/read-json";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export const GET = withAuth(
  async (_req, ctx) => {
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    await syncProviderCheckIns(pool, ctx.scope);
    const value = await getMyPresence(pool, ctx.scope, ctx.sub);
    return Response.json(value, { headers: NO_STORE });
  },
  { tier: "user" },
);

export const PUT = withAuth(
  async (req, ctx) => {
    const json = await readJson(req);
    if (!json.ok) return apiError(400, "invalid_request");
    const v = validateCheckIn(json.body);
    if (!v.ok) return apiError(400, "invalid_request");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const r = await checkIn(pool, ctx.scope, ctx.sub, v.value.roomId);
    if (!r.ok) {
      if (r.code === "already_checked_in") {
        return Response.json({ error: { code: r.code, room: r.room } } satisfies ApiErrorBody, {
          status: 409,
          headers: NO_STORE,
        });
      }
      return apiError(r.status, r.code);
    }
    return Response.json({ presence: r.value }, { headers: NO_STORE });
  },
  { tier: "user" },
);

export const PATCH = withAuth(
  async (req, ctx) => {
    const json = await readJson(req);
    if (!json.ok) return apiError(400, "invalid_request");
    const v = validateMove(json.body);
    if (!v.ok) return apiError(400, "invalid_request");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const r = await moveSeat(pool, ctx.scope, ctx.sub, v.value.seatId);
    if (!r.ok) return apiError(r.status, r.code);
    return Response.json({ presence: r.value }, { headers: NO_STORE });
  },
  { tier: "user" },
);

export const DELETE = withAuth(
  async (_req, ctx) => {
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const r = await checkOut(pool, ctx.scope, ctx.sub);
    if (!r.ok) return apiError(r.status, r.code);
    return Response.json({ presence: null }, { headers: NO_STORE });
  },
  { tier: "user" },
);
