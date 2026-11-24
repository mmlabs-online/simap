import { validateProjectCreate } from "@/lib/validate/group";
import { createProject, listProjects } from "@/server/groups/groups";
import { getPool } from "@/server/db/pool";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";
import { readJson } from "@/server/request/read-json";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export const GET = withAuth(
  async (_req, ctx) => {
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const projects = await listProjects(pool, ctx.scope);
    return Response.json({ projects }, { headers: NO_STORE });
  },
  { tier: "user" },
);

export const POST = withAuth(
  async (req, ctx) => {
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const body = await readJson(req);
    if (!body.ok) return apiError(400, "invalid_request");
    const v = validateProjectCreate(body.body);
    if (!v.ok) return apiError(400, "invalid_request");
    const r = await createProject(pool, ctx.scope, ctx.sub, v.value);
    if (!r.ok) return apiError(r.status, r.code);
    return Response.json(r.value, { status: 201, headers: NO_STORE });
  },
  { tier: "manager" },
);
