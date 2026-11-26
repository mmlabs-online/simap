import { isCanonicalUuid } from "@/lib/validate/uuid";
import { getPool } from "@/server/db/pool";
import { getDrive } from "@/server/drive/drive";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";
import { getMemberPhoto, removeMemberPhoto } from "@/server/members/photo";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const IMAGE_HEADERS = {
  "Cache-Control": "private, no-cache",
  "X-Content-Type-Options": "nosniff",
};

// No PUT: only the member sets their own photo (OQ-61); Next answers 405.

export const GET = withAuth<{ id: string }>(
  async (req, ctx, route) => {
    const { id } = await route.params;
    if (!isCanonicalUuid(id)) return apiError(404, "not_found");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const r = await getMemberPhoto(pool, getDrive, ctx.scope, id, req.headers.get("if-none-match"));
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

export const DELETE = withAuth<{ id: string }>(
  async (_req, ctx, route) => {
    const { id } = await route.params;
    if (!isCanonicalUuid(id)) return apiError(404, "not_found");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const r = await removeMemberPhoto(pool, getDrive, ctx.scope, ctx.sub, id);
    if (!r.ok) return apiError(r.status, r.code);
    return new Response(null, { status: 204, headers: NO_STORE });
  },
  { tier: "manager" },
);
