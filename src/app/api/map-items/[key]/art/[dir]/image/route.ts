import { MAP_ITEM_LIMITS } from "@/lib/map-items/types";
import { artDir, isMapItemKey } from "@/lib/validate/map-item";
import { parsePng } from "@/lib/validate/png";
import { getPool } from "@/server/db/pool";
import { getDrive } from "@/server/drive/drive";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";
import {
  IMAGE_VARY,
  getMapItemImage,
  removeMapItemImage,
  setMapItemImage,
} from "@/server/map-items/image";
import { readBytes } from "@/server/request/read-bytes";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const IMAGE_HEADERS = {
  "Cache-Control": "private, no-cache",
  "X-Content-Type-Options": "nosniff",
  Vary: IMAGE_VARY,
};

type Params = { key: string; dir: string };

export const PUT = withAuth<Params>(
  async (req, ctx, route) => {
    const { key, dir } = await route.params;
    const d = artDir(dir);
    if (!isMapItemKey(key) || d === null) return apiError(404, "not_found");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const body = await readBytes(req, MAP_ITEM_LIMITS.imageBytes, "image/png");
    if (!body.ok) {
      return apiError(422, body.reason === "too_large" ? "image_too_large" : "image_not_png");
    }
    const png = parsePng(body.bytes);
    if (!png.ok) return apiError(422, png.code);
    const r = await setMapItemImage(pool, getDrive, ctx.scope, ctx.sub, key, d, body.bytes, png);
    if (!r.ok) return apiError(r.status, r.code);
    return Response.json(r.value, { headers: NO_STORE });
  },
  { tier: "admin" },
);

export const DELETE = withAuth<Params>(
  async (_req, ctx, route) => {
    const { key, dir } = await route.params;
    const d = artDir(dir);
    if (!isMapItemKey(key) || d === null) return apiError(404, "not_found");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const r = await removeMapItemImage(pool, getDrive, ctx.scope, ctx.sub, key, d);
    if (!r.ok) return apiError(r.status, r.code);
    return new Response(null, { status: 204, headers: NO_STORE });
  },
  { tier: "admin" },
);

export const GET = withAuth<Params>(
  async (req, ctx, route) => {
    const { key, dir } = await route.params;
    const d = artDir(dir);
    if (!isMapItemKey(key) || d === null) return apiError(404, "not_found");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const r = await getMapItemImage(
      pool,
      getDrive,
      ctx.scope,
      key,
      d,
      req.headers.get("if-none-match"),
    );
    if (!r.ok) return apiError(r.status, r.code);
    if (r.value.kind === "not_modified") {
      return new Response(null, { status: 304, headers: { ...IMAGE_HEADERS, ETag: r.value.etag } });
    }
    return new Response(r.value.bytes as BodyInit, {
      status: 200,
      headers: {
        ...IMAGE_HEADERS,
        ETag: r.value.etag,
        "Content-Type": "image/png",
        "Content-Disposition": "inline",
        "Content-Security-Policy": "sandbox",
        "Content-Length": String(r.value.bytes.byteLength),
      },
    });
  },
  { tier: "user" },
);
