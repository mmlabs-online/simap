import { EXPORT_MAX_ROWS, exportFilename, isExportKind, toCsv } from "@/lib/export/csv";
import { getPool } from "@/server/db/pool";
import { exportRows } from "@/server/export/export";
import { apiError } from "@/server/http/respond";
import { withAuth } from "@/server/http/with-auth";

export const dynamic = "force-dynamic";

export const GET = withAuth<{ kind: string }>(
  async (_req, ctx, route) => {
    const { kind } = await route.params;
    if (!isExportKind(kind)) return apiError(404, "not_found");
    const pool = getPool();
    if (!pool) return apiError(503, "unavailable");
    const { columns, rows, truncated } = await exportRows(pool, ctx.scope, kind, EXPORT_MAX_ROWS);
    const headers: Record<string, string> = {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${exportFilename(kind, new Date())}"`,
      "X-Content-Type-Options": "nosniff",
    };
    if (truncated) headers["X-Export-Truncated"] = "true";
    return new Response(toCsv(columns, rows), { headers });
  },
  { tier: "manager" },
);
