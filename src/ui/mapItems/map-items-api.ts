import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import type { MapItemDto, MapItemPatchValue } from "@/lib/map-items/types";

export type MapItemsResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: string; rooms?: number };

const fail = (code: string): { ok: false; code: string } => ({ ok: false, code });

/** The error code, plus the room count a 409 `item_in_use` carries (only when it is a count). */
async function errorOf(res: Response): Promise<{ ok: false; code: string; rooms?: number }> {
  try {
    const error = ((await res.json()) as { error?: { code?: unknown; rooms?: unknown } } | null)
      ?.error;
    const code = typeof error?.code === "string" ? error.code : "internal";
    const rooms = error?.rooms;
    return typeof rooms === "number" && Number.isInteger(rooms) && rooms >= 0
      ? { ok: false, code, rooms }
      : fail(code);
  } catch {
    return fail("internal");
  }
}

/** Map item catalog calls through the one bearer `apiFetch`. Every method resolves to a result and never throws. */
export function createMapItemsApi(fetcher: ApiFetch) {
  async function call<T>(
    path: string,
    init: RequestInit,
    read: (res: Response) => Promise<MapItemsResult<T>>,
  ): Promise<MapItemsResult<T>> {
    let res: Response;
    try {
      res = await fetcher(path, init);
    } catch (e) {
      if (e instanceof ApiAccessError) {
        return fail(e.code === "signed_out" ? "unauthenticated" : e.code);
      }
      return fail("unavailable");
    }
    if (!res.ok) return errorOf(res);
    try {
      return await read(res);
    } catch {
      return fail("internal");
    }
  }

  const json = (res: Response): Promise<MapItemsResult<MapItemDto>> =>
    res.json().then((value: MapItemDto) => ({ ok: true as const, value }));
  const base = "/api/map-items";

  return {
    list: () =>
      call<MapItemDto[]>(base, { method: "GET" }, async (res) => {
        const items = ((await res.json()) as Record<string, unknown> | null)?.items;
        return Array.isArray(items) ? { ok: true, value: items as MapItemDto[] } : fail("internal");
      }),
    patch: (key: string, value: MapItemPatchValue) =>
      call(
        `${base}/${encodeURIComponent(key)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(value),
        },
        json,
      ),
    reset: (key: string) =>
      call(`${base}/${encodeURIComponent(key)}/reset`, { method: "POST" }, json),
  };
}

export type MapItemsApi = ReturnType<typeof createMapItemsApi>;
