import { MAP_ITEM_LIMITS } from "@/lib/map-items/types";
import type { ApiErrorBody } from "@/lib/api/error";
import { isMapItemKey, validateMapItemPatch } from "@/lib/validate/map-item";
import { getPool } from "@/server/db/pool";
import { getDrive } from "@/server/drive/drive";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";
import { discardMapItemFiles } from "@/server/map-items/drive-cleanup";
import { updateMapItem } from "@/server/map-items/edit";
import { readJson } from "@/server/request/read-json";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

const inUse = (rooms: number) =>
  Response.json({ error: { code: "item_in_use", rooms } } satisfies ApiErrorBody, {
    status: 409,
    headers: NO_STORE,
  });

export const PATCH = withAuth<{ key: string }>(
  async (req, ctx, route) => {
    const { key } = await route.params;
    if (!isMapItemKey(key)) return apiError(404, "not_found");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const body = await readJson(req, MAP_ITEM_LIMITS.bodyBytes);
    if (!body.ok) return apiError(400, "invalid_request");
    const v = validateMapItemPatch(body.body);
    if (!v.ok) return apiError(400, "invalid_request");
    const r = await updateMapItem(pool, ctx.scope, ctx.sub, key, v.value);
    if (!r.ok) return r.code === "item_in_use" ? inUse(r.rooms ?? 0) : apiError(r.status, r.code);
    await discardMapItemFiles(getDrive, r.value.discardFileIds, key);
    return Response.json(r.value.item, { headers: NO_STORE });
  },
  { tier: "admin" },
);
