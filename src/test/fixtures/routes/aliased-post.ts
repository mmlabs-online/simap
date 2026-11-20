import { withAuth } from "@/server/http/with-auth";

export const GET = withAuth(async () => new Response(null), { tier: "user" });

const h = async () => new Response(null);
export { h as POST };
