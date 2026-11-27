import { validateMePatch } from "@/lib/validate/member";
import { getPool } from "@/server/db/pool";
import { apiError } from "@/server/http/respond";
import { withAuth, type AuthContext } from "@/server/http/with-auth";
import { getMember, getOrCreateMember, setOwnDisplayName } from "@/server/members/members";
import { readJson } from "@/server/request/read-json";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

const body = (ctx: AuthContext, member: unknown) =>
  Response.json(
    { sub: ctx.sub, email: ctx.email, org: ctx.org, tier: ctx.tier, access: ctx.access, member },
    { headers: NO_STORE },
  );

export const GET = withAuth(
  async (_req, ctx) => {
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    if (ctx.access === "super_admin") return body(ctx, await getMember(pool, ctx.scope, ctx.sub));
    const r = await getOrCreateMember(pool, ctx.scope, { sub: ctx.sub, email: ctx.email });
    if (!r.ok) return apiError(r.status, r.code);
    return body(ctx, r.value);
  },
  { tier: "user" },
);

export const PATCH = withAuth(
  async (req, ctx) => {
    const json = await readJson(req);
    if (!json.ok) return apiError(400, "invalid_request");
    const v = validateMePatch(json.body);
    if (!v.ok) return apiError(400, "invalid_request");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    if (ctx.access === "super_admin" && !(await getMember(pool, ctx.scope, ctx.sub))) {
      return apiError(422, "no_linked_member");
    }
    const r = await setOwnDisplayName(
      pool,
      ctx.scope,
      { sub: ctx.sub, email: ctx.email },
      v.value.displayName,
    );
    if (!r.ok) return apiError(r.status, r.code);
    return body(ctx, r.value);
  },
  { tier: "user" },
);
