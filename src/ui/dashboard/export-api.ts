import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import type { ExportKind } from "@/lib/export/csv";

export type ExportDownload =
  | { ok: true; blob: Blob; filename: string; truncated: boolean }
  | { ok: false; code: string };

const fail = (code: string): { ok: false; code: string } => ({ ok: false, code });

/** The `filename="..."` of a Content-Disposition header, or null when missing or odd. */
export function filenameFromDisposition(header: string | null): string | null {
  const m = header ? /filename="([A-Za-z0-9._-]+)"/.exec(header) : null;
  return m ? m[1]! : null;
}

async function errorCode(res: Response): Promise<string> {
  try {
    const code = ((await res.json()) as { error?: { code?: unknown } } | null)?.error?.code;
    return typeof code === "string" ? code : "internal";
  } catch {
    return "internal";
  }
}

/** CSV download through the one bearer `apiFetch` (no token in the URL). Resolves to a result and never throws. */
export function createExportApi(fetcher: ApiFetch) {
  return {
    async download(kind: ExportKind): Promise<ExportDownload> {
      let res: Response;
      try {
        res = await fetcher(`/api/export/${kind}`, { method: "GET" });
      } catch (e) {
        if (e instanceof ApiAccessError) {
          return fail(e.code === "signed_out" ? "unauthenticated" : e.code);
        }
        return fail("unavailable");
      }
      if (!res.ok) return fail(await errorCode(res));
      try {
        return {
          ok: true,
          blob: await res.blob(),
          filename:
            filenameFromDisposition(res.headers.get("content-disposition")) ?? `simap-${kind}.csv`,
          truncated: res.headers.get("x-export-truncated") === "true",
        };
      } catch {
        return fail("internal");
      }
    },
  };
}

export type ExportApi = ReturnType<typeof createExportApi>;
