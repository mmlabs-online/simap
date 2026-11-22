import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import type { RoomSeatsResponse, SeatDto } from "@/lib/seats/types";

export type SeatsResult<T> = { ok: true; value: T } | { ok: false; code: string };

const fail = (code: string): { ok: false; code: string } => ({ ok: false, code });

async function errorCode(res: Response): Promise<string> {
  try {
    const code = ((await res.json()) as { error?: { code?: unknown } } | null)?.error?.code;
    return typeof code === "string" ? code : "internal";
  } catch {
    return "internal";
  }
}

const isObject = (b: unknown): b is Record<string, unknown> => typeof b === "object" && b !== null;
const isSeat = (b: unknown) => isObject(b) && typeof b.id === "string" && Array.isArray(b.devices);

/** Seat calls through the one bearer `apiFetch`. Every method resolves to a result and never throws. */
export function createSeatsApi(fetcher: ApiFetch) {
  async function call<T>(
    path: string,
    init: RequestInit,
    read: (res: Response) => Promise<SeatsResult<T>>,
  ): Promise<SeatsResult<T>> {
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

  const json =
    <T>(valid: (body: unknown) => boolean) =>
    async (res: Response): Promise<SeatsResult<T>> => {
      const body: unknown = await res.json();
      return valid(body) ? { ok: true, value: body as T } : fail("internal");
    };
  const roomSeatsPath = (roomId: string) => `/api/rooms/${encodeURIComponent(roomId)}/seats`;
  const seatPath = (seatId: string) => `/api/seats/${encodeURIComponent(seatId)}`;

  return {
    list: (roomId: string) =>
      call<RoomSeatsResponse>(
        roomSeatsPath(roomId),
        { method: "GET" },
        json((b) => isObject(b) && Array.isArray(b.items) && typeof b.truncated === "boolean"),
      ),
    get: (seatId: string) => call<SeatDto>(seatPath(seatId), { method: "GET" }, json(isSeat)),
    add: (roomId: string, count: number) =>
      call<SeatDto[]>(
        roomSeatsPath(roomId),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ count }),
        },
        async (res) => {
          const body: unknown = await res.json();
          return isObject(body) && Array.isArray(body.items)
            ? { ok: true, value: body.items as SeatDto[] }
            : fail("internal");
        },
      ),
    remove: (seatId: string) =>
      call<null>(seatPath(seatId), { method: "DELETE" }, async () => ({ ok: true, value: null })),
    release: (seatId: string) =>
      call<SeatDto>(`${seatPath(seatId)}/release`, { method: "POST" }, json(isSeat)),
  };
}

export type SeatsApi = ReturnType<typeof createSeatsApi>;
