import { withAuth } from "@/server/http/with-auth";

export const dynamic = "force-dynamic";

export const GET = withAuth(
  async (_req, ctx) => Response.json(ctx, { headers: { "Cache-Control": "no-store" } }),
  { tier: "user" },
);
