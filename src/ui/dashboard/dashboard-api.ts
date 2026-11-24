import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import type { DashboardDto } from "@/lib/dashboard/types";

export type DashboardResult<T> = { ok: true; value: T } | { ok: false; code: string };

const fail = (code: string): { ok: false; code: string } => ({ ok: false, code });

async function errorCode(res: Response): Promise<string> {
  try {
    const code = ((await res.json()) as { error?: { code?: unknown } } | null)?.error?.code;
    return typeof code === "string" ? code : "internal";
  } catch {
    return "internal";
  }
}

/** Dashboard call through the one bearer `apiFetch`. Resolves to a result and never throws. */
export function createDashboardApi(fetcher: ApiFetch) {
  return {
    async get(): Promise<DashboardResult<DashboardDto>> {
      let res: Response;
      try {
        res = await fetcher("/api/dashboard", { method: "GET" });
      } catch (e) {
        if (e instanceof ApiAccessError) {
          return fail(e.code === "signed_out" ? "unauthenticated" : e.code);
        }
        return fail("unavailable");
      }
      if (!res.ok) return fail(await errorCode(res));
      try {
        const body = (await res.json()) as Partial<DashboardDto> | null;
        return typeof body?.totals === "object" && body.totals !== null && Array.isArray(body.rooms)
          ? { ok: true, value: body as DashboardDto }
          : fail("internal");
      } catch {
        return fail("internal");
      }
    },
  };
}

export type DashboardApi = ReturnType<typeof createDashboardApi>;
