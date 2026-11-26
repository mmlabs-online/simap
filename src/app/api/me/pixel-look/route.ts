import { validatePixelLook } from "@/lib/validate/pixel-look";
import { getPool } from "@/server/db/pool";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";
import { getOwnPixelLook, setOwnPixelLook } from "@/server/members/pixel-look";
import { readJson } from "@/server/request/read-json";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export const GET = withAuth(
  async (_req, ctx) => {
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const r = await getOwnPixelLook(pool, ctx.scope, ctx.sub);
    if (!r.ok) return apiError(r.status, r.code);
    return Response.json({ look: r.value }, { headers: NO_STORE });
  },
  { tier: "user" },
);

export const PUT = withAuth(
  async (req, ctx) => {
    const json = await readJson(req);
    if (!json.ok) return apiError(400, "invalid_request");
    const v = validatePixelLook(json.body);
    if (!v.ok)
      return v.field === "body" ? apiError(400, "invalid_request") : apiError(422, "invalid_look");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const r = await setOwnPixelLook(pool, ctx.scope, ctx.sub, v.value);
    if (!r.ok) return apiError(r.status, r.code);
    return Response.json({ look: r.value }, { headers: NO_STORE });
  },
  { tier: "user" },
);

export const DELETE = withAuth(
  async (_req, ctx) => {
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const r = await setOwnPixelLook(pool, ctx.scope, ctx.sub, null);
    if (!r.ok) return apiError(r.status, r.code);
    return Response.json({ look: null }, { headers: NO_STORE });
  },
  { tier: "user" },
);
