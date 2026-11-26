import { PHOTO_LIMITS, stripPhotoMetadata, validatePhoto } from "@/lib/validate/photo";
import { getPool } from "@/server/db/pool";
import { getDrive } from "@/server/drive/drive";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";
import { getOwnPhoto, removeOwnPhoto, setOwnPhoto } from "@/server/members/photo";
import { readBytes } from "@/server/request/read-bytes";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const IMAGE_HEADERS = {
  "Cache-Control": "private, no-cache",
  "X-Content-Type-Options": "nosniff",
};

export const PUT = withAuth(
  async (req, ctx) => {
    const body = await readBytes(req, PHOTO_LIMITS.maxBytes, ["image/png", "image/jpeg"]);
    if (!body.ok) {
      return apiError(422, body.reason === "too_large" ? "image_too_large" : "image_not_supported");
    }
    const checked = validatePhoto(body.bytes);
    if (!checked.ok) return apiError(422, checked.code);
    const bytes = stripPhotoMetadata(body.bytes, checked.type);
    // Defensive: stripping a valid photo must give a valid photo of the same type. A failure is a bug (500).
    const again = validatePhoto(bytes);
    if (!again.ok || again.type !== checked.type)
      throw new Error("photo strip produced an invalid image");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const r = await setOwnPhoto(pool, getDrive, ctx.scope, ctx.sub, { bytes, type: checked.type });
    if (!r.ok) return apiError(r.status, r.code);
    return Response.json(r.value, { headers: NO_STORE });
  },
  { tier: "user" },
);

export const DELETE = withAuth(
  async (_req, ctx) => {
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const r = await removeOwnPhoto(pool, getDrive, ctx.scope, ctx.sub);
    if (!r.ok) return apiError(r.status, r.code);
    return new Response(null, { status: 204, headers: NO_STORE });
  },
  { tier: "user" },
);

export const GET = withAuth(
  async (req, ctx) => {
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const r = await getOwnPhoto(
      pool,
      getDrive,
      ctx.scope,
      ctx.sub,
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
        "Content-Type": r.value.contentType,
        "Content-Disposition": "inline",
        "Content-Security-Policy": "sandbox",
        "Content-Length": String(r.value.bytes.byteLength),
      },
    });
  },
  { tier: "user" },
);
