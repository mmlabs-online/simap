import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import type { DeviceDto, PlacementFilter } from "@/lib/devices/types";

export type DevicesResult<T> = { ok: true; value: T } | { ok: false; code: string };

const fail = (code: string): { ok: false; code: string } => ({ ok: false, code });

async function errorCode(res: Response): Promise<string> {
  try {
    const code = ((await res.json()) as { error?: { code?: unknown } } | null)?.error?.code;
    return typeof code === "string" ? code : "internal";
  } catch {
    return "internal";
  }
}

/** Device calls through the one bearer `apiFetch`. Every method resolves to a result and never throws. */
export function createDevicesApi(fetcher: ApiFetch) {
  async function call<T>(
    path: string,
    init: RequestInit,
    read: (res: Response) => Promise<DevicesResult<T>>,
  ): Promise<DevicesResult<T>> {
    let res: Response;
    try {
      res = await fetcher(path, init);
    } catch (e) {
      if (e instanceof ApiAccessError) {
        return fail(e.code === "signed_out" ? "unauthenticated" : e.code);
      }
      return fail("unavailable");
    }
    if (!res.ok) return fail(await errorCode(res));
    try {
      return await read(res);
    } catch {
      return fail("internal");
    }
  }

  return {
    list: (filter: PlacementFilter) =>
      call<{ items: DeviceDto[]; truncated: boolean }>(
        `/api/devices?placement=${filter}`,
        { method: "GET" },
        async (res) => {
          const body = (await res.json()) as { items?: unknown; truncated?: unknown };
          return Array.isArray(body?.items) && typeof body.truncated === "boolean"
            ? { ok: true, value: { items: body.items as DeviceDto[], truncated: body.truncated } }
            : fail("internal");
        },
      ),
  };
}

export type DevicesApi = ReturnType<typeof createDevicesApi>;
