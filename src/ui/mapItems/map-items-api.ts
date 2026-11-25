import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import type { MapItemDto } from "@/lib/map-items/types";

export type MapItemsResult<T> = { ok: true; value: T } | { ok: false; code: string };

const fail = (code: string): { ok: false; code: string } => ({ ok: false, code });

async function errorCode(res: Response): Promise<string> {
  try {
    const code = ((await res.json()) as { error?: { code?: unknown } } | null)?.error?.code;
    return typeof code === "string" ? code : "internal";
  } catch {
    return "internal";
  }
}

/** Map item catalog calls through the one bearer `apiFetch`. Every method resolves to a result and never throws. */
export function createMapItemsApi(fetcher: ApiFetch) {
  return {
    list: async (): Promise<MapItemsResult<MapItemDto[]>> => {
      let res: Response;
      try {
        res = await fetcher("/api/map-items", { method: "GET" });
      } catch (e) {
        if (e instanceof ApiAccessError) {
          return fail(e.code === "signed_out" ? "unauthenticated" : e.code);
        }
        return fail("unavailable");
      }
      if (!res.ok) return fail(await errorCode(res));
      try {
        const items = ((await res.json()) as Record<string, unknown> | null)?.items;
        return Array.isArray(items) ? { ok: true, value: items as MapItemDto[] } : fail("internal");
      } catch {
        return fail("internal");
      }
    },
  };
}

export type MapItemsApi = ReturnType<typeof createMapItemsApi>;
