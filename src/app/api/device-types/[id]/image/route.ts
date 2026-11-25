import { IMAGE_LIMITS, validatePng } from "@/lib/validate/png";
import { isCanonicalUuid } from "@/lib/validate/uuid";
import { getPool } from "@/server/db/pool";
import {
  getDeviceTypeImage,
  removeDeviceTypeImage,
  setDeviceTypeImage,
} from "@/server/device-types/image";
import { getDrive } from "@/server/drive/drive";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";
import { readBytes } from "@/server/request/read-bytes";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const IMAGE_HEADERS = {
  "Cache-Control": "private, no-cache",
  "X-Content-Type-Options": "nosniff",
};

export const PUT = withAuth<{ id: string }>(
  async (req, ctx, route) => {
    const { id } = await route.params;
    if (!isCanonicalUuid(id)) return apiError(404, "not_found");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const body = await readBytes(req, IMAGE_LIMITS.maxBytes, "image/png");
    if (!body.ok) {
      return apiError(422, body.reason === "too_large" ? "image_too_large" : "image_not_png");
    }
    const png = validatePng(body.bytes);
    if (!png.ok) return apiError(422, png.code);
    const r = await setDeviceTypeImage(pool, getDrive, ctx.scope, ctx.sub, id, body.bytes);
    if (!r.ok) return apiError(r.status, r.code);
    return Response.json(r.value, { headers: NO_STORE });
  },
  { tier: "admin" },
);

export const DELETE = withAuth<{ id: string }>(
  async (_req, ctx, route) => {
    const { id } = await route.params;
    if (!isCanonicalUuid(id)) return apiError(404, "not_found");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const r = await removeDeviceTypeImage(pool, getDrive, ctx.scope, ctx.sub, id);
    if (!r.ok) return apiError(r.status, r.code);
    return new Response(null, { status: 204, headers: NO_STORE });
  },
  { tier: "admin" },
);

export const GET = withAuth<{ id: string }>(
  async (req, ctx, route) => {
    const { id } = await route.params;
    if (!isCanonicalUuid(id)) return apiError(404, "not_found");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const r = await getDeviceTypeImage(
      pool,
      getDrive,
      ctx.scope,
      id,
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
