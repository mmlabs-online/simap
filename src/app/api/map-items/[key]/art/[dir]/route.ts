import { MAP_ITEM_LIMITS } from "@/lib/map-items/types";
import { artDir, isMapItemKey, validateMapItemArt } from "@/lib/validate/map-item";
import { getPool } from "@/server/db/pool";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";
import { setMapItemArt } from "@/server/map-items/edit";
import { readJson } from "@/server/request/read-json";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export const PUT = withAuth<{ key: string; dir: string }>(
  async (req, ctx, route) => {
    const { key, dir } = await route.params;
    const d = artDir(dir);
    if (!isMapItemKey(key) || d === null) return apiError(404, "not_found");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const body = await readJson(req, MAP_ITEM_LIMITS.bodyBytes);
    if (!body.ok) return apiError(400, "invalid_request");
    const v = validateMapItemArt(body.body);
    if (!v.ok) return apiError(400, "invalid_request");
    const r = await setMapItemArt(pool, ctx.scope, ctx.sub, key, d, v.value.sprite);
    if (!r.ok) return apiError(r.status, r.code);
    return Response.json(r.value, { headers: NO_STORE });
  },
  { tier: "admin" },
);
