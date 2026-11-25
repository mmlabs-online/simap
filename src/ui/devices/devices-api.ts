import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import type {
  AssignValue,
  DeviceDto,
  DevicePatchValue,
  HandoffDto,
  HandoffStartValue,
  HoldingPatchValue,
  PlacementFilter,
} from "@/lib/devices/types";
import type { DeviceCreateBody } from "./device-form";
import type { PlacementBody } from "./place-device";

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

  const isDevice = (b: unknown) =>
    typeof b === "object" && b !== null && typeof (b as { id?: unknown }).id === "string";
  const oneDevice = async (res: Response): Promise<DevicesResult<DeviceDto>> => {
    const body: unknown = await res.json();
    return isDevice(body) ? { ok: true, value: body as DeviceDto } : fail("internal");
  };
  const oneHandoff = async (res: Response): Promise<DevicesResult<HandoffDto>> => {
    const body: unknown = await res.json();
    return isDevice(body) ? { ok: true, value: body as HandoffDto } : fail("internal");
  };
  const devicePath = (id: string) => `/api/devices/${encodeURIComponent(id)}`;

  return {
    get: (id: string) => call<DeviceDto>(devicePath(id), { method: "GET" }, oneDevice),
    create: (body: DeviceCreateBody) =>
      call<DeviceDto>(
        "/api/devices",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
        oneDevice,
      ),
    update: (id: string, body: DevicePatchValue) =>
      call<DeviceDto>(
        devicePath(id),
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
        oneDevice,
      ),
    place: (id: string, body: PlacementBody) =>
      call<DeviceDto>(
        `${devicePath(id)}/placement`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
        oneDevice,
      ),
    assign: (id: string, body: AssignValue) =>
      call<DeviceDto>(
        `${devicePath(id)}/assignment`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
        oneDevice,
      ),
    updateHolding: (id: string, body: HoldingPatchValue) =>
      call<DeviceDto>(
        `${devicePath(id)}/holding`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
        oneDevice,
      ),
    startTransfer: (id: string, body: HandoffStartValue) =>
      call<HandoffDto>(
        `${devicePath(id)}/handoffs`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
        oneHandoff,
      ),
    cancelHandoff: (handoffId: string) =>
      call<HandoffDto>(
        `/api/handoffs/${encodeURIComponent(handoffId)}/cancel`,
        { method: "POST" },
        oneHandoff,
      ),
    remove: (id: string) =>
      call<void>(devicePath(id), { method: "DELETE" }, async () => ({
        ok: true,
        value: undefined,
      })),
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
