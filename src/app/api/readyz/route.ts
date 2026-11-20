import { getPool, ping } from "@/server/db/pool";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

const unavailable = () => Response.json({ status: "unavailable" }, { status: 503, headers });

export async function GET() {
  const pool = getPool();
  if (!pool) return unavailable();
  try {
    await ping(pool);
    return Response.json({ status: "ok" }, { headers });
  } catch (err) {
    const code = (err as { code?: unknown } | null)?.code;
    const logged =
      typeof code === "string"
        ? code
        : err instanceof Error && err.message === "timeout"
          ? "timeout"
          : "error";
    console.error(JSON.stringify({ event: "readyz_unavailable", code: logged }));
    return unavailable();
  }
}
