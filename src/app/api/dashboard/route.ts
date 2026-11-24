import { atLeast } from "@/lib/auth/tier";
import { getDashboard } from "@/server/dashboard/dashboard";
import { getPool } from "@/server/db/pool";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";

export const dynamic = "force-dynamic";

export const GET = withAuth(
  async (_req, ctx) => {
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const dto = await getDashboard(pool, ctx.scope, {
      includeHolders: atLeast(ctx.tier, "manager"),
    });
    return Response.json(dto, { headers: { "Cache-Control": "no-store" } });
  },
  { tier: "user" },
);
