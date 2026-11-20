import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import type { DeleteImpact, RoomDto } from "@/lib/rooms/types";
import type { RoomCreateValue, RoomPatchValue } from "@/lib/validate/room";

export type RoomsResult<T> = { ok: true; value: T } | { ok: false; code: string };

const fail = (code: string): { ok: false; code: string } => ({ ok: false, code });

async function errorCode(res: Response): Promise<string> {
  try {
    const code = ((await res.json()) as { error?: { code?: unknown } } | null)?.error?.code;
    return typeof code === "string" ? code : "internal";
  } catch {
    return "internal";
  }
}

/** Room calls through the one bearer `apiFetch`. Every method resolves to a result and never throws. */
export function createRoomsApi(fetcher: ApiFetch) {
  async function call<T>(
    path: string,
    init: RequestInit,
    read: (res: Response) => Promise<RoomsResult<T>>,
  ): Promise<RoomsResult<T>> {
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

  const json = <T>(res: Response): Promise<RoomsResult<T>> =>
    res.json().then((value: T) => ({ ok: true as const, value }));
  const withBody = (method: string, body: unknown): RequestInit => ({
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const roomPath = (id: string) => `/api/rooms/${encodeURIComponent(id)}`;

  return {
    list: () =>
      call<RoomDto[]>("/api/rooms", { method: "GET" }, async (res) => {
        const body = (await res.json()) as { rooms?: unknown };
        return Array.isArray(body?.rooms)
          ? { ok: true, value: body.rooms as RoomDto[] }
          : fail("internal");
      }),
    create: (body: RoomCreateValue) =>
      call<RoomDto>("/api/rooms", withBody("POST", body), json<RoomDto>),
    update: (id: string, patch: RoomPatchValue) =>
      call<RoomDto>(roomPath(id), withBody("PATCH", patch), json<RoomDto>),
    impact: (id: string) =>
      call<DeleteImpact>(`${roomPath(id)}/delete-impact`, { method: "GET" }, json<DeleteImpact>),
    remove: (id: string, force: boolean) =>
      call<null>(
        `${roomPath(id)}${force ? "?force=true" : ""}`,
        { method: "DELETE" },
        async () => ({ ok: true, value: null }),
      ),
  };
}

export type RoomsApi = ReturnType<typeof createRoomsApi>;
