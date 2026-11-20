import { withAuth } from "@/server/http/with-auth";

export const dynamic = "force-dynamic";

export const GET = withAuth(
  async (_req, ctx) =>
    Response.json(
      { sub: ctx.sub, email: ctx.email, org: ctx.org, tier: ctx.tier },
      { headers: { "Cache-Control": "no-store" } },
    ),
  { tier: "user" },
);
