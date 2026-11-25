import type { ApiErrorBody } from "@/lib/api/error";
import { isMapItemKey } from "@/lib/validate/map-item";
import { getPool } from "@/server/db/pool";
import { getDrive } from "@/server/drive/drive";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";
import { discardMapItemFiles } from "@/server/map-items/drive-cleanup";
import { resetMapItem } from "@/server/map-items/edit";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

const inUse = (rooms: number) =>
  Response.json({ error: { code: "item_in_use", rooms } } satisfies ApiErrorBody, {
    status: 409,
    headers: NO_STORE,
  });

export const POST = withAuth<{ key: string }>(
  async (_req, ctx, route) => {
    const { key } = await route.params;
    if (!isMapItemKey(key)) return apiError(404, "not_found");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const r = await resetMapItem(pool, ctx.scope, ctx.sub, key);
    if (!r.ok) return r.code === "item_in_use" ? inUse(r.rooms ?? 0) : apiError(r.status, r.code);
    await discardMapItemFiles(getDrive, r.value.discardFileIds, key);
    return Response.json(r.value.item, { headers: NO_STORE });
  },
  { tier: "admin" },
);
