import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import type {
  DeviceTypeCreateValue,
  DeviceTypeDto,
  DeviceTypePatchValue,
} from "@/lib/device-types/types";

export type DeviceTypesResult<T> = { ok: true; value: T } | { ok: false; code: string };

const fail = (code: string): { ok: false; code: string } => ({ ok: false, code });

async function errorCode(res: Response): Promise<string> {
  try {
    const code = ((await res.json()) as { error?: { code?: unknown } } | null)?.error?.code;
    return typeof code === "string" ? code : "internal";
  } catch {
    return "internal";
  }
}

/** Device type calls through the one bearer `apiFetch`. Every method resolves to a result and never throws. */
export function createDeviceTypesApi(fetcher: ApiFetch) {
  async function call<T>(
    path: string,
    init: RequestInit,
    read: (res: Response) => Promise<DeviceTypesResult<T>>,
  ): Promise<DeviceTypesResult<T>> {
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

  const json = (res: Response): Promise<DeviceTypesResult<DeviceTypeDto>> =>
    res.json().then((value: DeviceTypeDto) => ({ ok: true as const, value }));
  const withBody = (method: string, body: unknown): RequestInit => ({
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const base = "/api/device-types";

  return {
    list: () =>
      call<DeviceTypeDto[]>(base, { method: "GET" }, async (res) => {
        const items = ((await res.json()) as Record<string, unknown> | null)?.items;
        return Array.isArray(items)
          ? { ok: true, value: items as DeviceTypeDto[] }
          : fail("internal");
      }),
    create: (body: DeviceTypeCreateValue) => call(base, withBody("POST", body), json),
    update: (id: string, patch: DeviceTypePatchValue) =>
      call(`${base}/${encodeURIComponent(id)}`, withBody("PATCH", patch), json),
    remove: (id: string) =>
      call<null>(`${base}/${encodeURIComponent(id)}`, { method: "DELETE" }, async () => ({
        ok: true,
        value: null,
      })),
  };
}

export type DeviceTypesApi = ReturnType<typeof createDeviceTypesApi>;
