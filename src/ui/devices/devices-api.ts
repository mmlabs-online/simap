import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import type {
  AssignValue,
  DeviceDto,
  DeviceHistoryPage,
  DevicePatchValue,
  HandoffBox,
  HandoffCountDto,
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
  const listHandoffs = (box: HandoffBox) =>
    call<{ items: HandoffDto[]; truncated: boolean }>(
      `/api/handoffs?box=${box}`,
      { method: "GET" },
      async (res) => {
        const body = (await res.json()) as { items?: unknown; truncated?: unknown };
        return Array.isArray(body?.items) && typeof body.truncated === "boolean"
          ? { ok: true, value: { items: body.items as HandoffDto[], truncated: body.truncated } }
          : fail("internal");
      },
    );

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
    confirmHandoff: (handoffId: string) =>
      call<HandoffDto>(
        `/api/handoffs/${encodeURIComponent(handoffId)}/confirm`,
        { method: "POST" },
        oneHandoff,
      ),
    declineHandoff: (handoffId: string) =>
      call<HandoffDto>(
        `/api/handoffs/${encodeURIComponent(handoffId)}/decline`,
        { method: "POST" },
        oneHandoff,
      ),
    startReturn: (id: string, note: string | null) =>
      call<HandoffDto>(
        `${devicePath(id)}/handoffs`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: "return", note }),
        },
        oneHandoff,
      ),
    startExtension: (id: string, newExpiresOn: string, note: string | null) =>
      call<HandoffDto>(
        `${devicePath(id)}/handoffs`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: "extension", newExpiresOn, note }),
        },
        oneHandoff,
      ),
    takeBack: (id: string) =>
      call<DeviceDto>(`${devicePath(id)}/take-back`, { method: "POST" }, oneDevice),
    incomingHandoffs: () => listHandoffs("incoming"),
    pendingReturns: () => listHandoffs("returns"),
    handoffCount: () =>
      call<HandoffCountDto>("/api/handoffs/count", { method: "GET" }, async (res) => {
        const body = (await res.json()) as {
          incoming?: unknown;
          returns?: unknown;
          extensions?: unknown;
          overdue?: unknown;
        };
        const n = (v: unknown) => (typeof v === "number" ? v : 0);
        return typeof body?.incoming === "number"
          ? {
              ok: true,
              value: {
                incoming: body.incoming,
                returns: n(body.returns),
                extensions: n(body.extensions),
                overdue: n(body.overdue),
              },
            }
          : fail("internal");
      }),
    remove: (id: string) =>
      call<void>(devicePath(id), { method: "DELETE" }, async () => ({
        ok: true,
        value: undefined,
      })),
    history: (id: string, cursor?: string) =>
      call<DeviceHistoryPage>(
        `${devicePath(id)}/history${cursor === undefined ? "" : `?cursor=${encodeURIComponent(cursor)}`}`,
        { method: "GET" },
        async (res) => {
          const b = (await res.json()) as {
            items?: unknown;
            nextCursor?: unknown;
            holderSince?: unknown;
          };
          const strOrNull = (v: unknown) => typeof v === "string" || v === null;
          return Array.isArray(b?.items) && strOrNull(b.nextCursor) && strOrNull(b.holderSince)
            ? { ok: true, value: b as DeviceHistoryPage }
            : fail("internal");
        },
      ),
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
