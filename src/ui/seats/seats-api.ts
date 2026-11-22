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

/** Seat reads through the one bearer `apiFetch`. Every method resolves to a result and never throws. */
export function createSeatsApi(fetcher: ApiFetch) {
  async function get<T>(path: string, valid: (body: unknown) => boolean): Promise<SeatsResult<T>> {
    let res: Response;
    try {
      res = await fetcher(path, { method: "GET" });
    } catch (e) {
      if (e instanceof ApiAccessError) {
        return fail(e.code === "signed_out" ? "unauthenticated" : e.code);
      }
      return fail("unavailable");
    }
    if (!res.ok) return fail(await errorCode(res));
    try {
      const body: unknown = await res.json();
      return valid(body) ? { ok: true, value: body as T } : fail("internal");
    } catch {
      return fail("internal");
    }
  }

  const isObject = (b: unknown): b is Record<string, unknown> =>
    typeof b === "object" && b !== null;

  return {
    list: (roomId: string) =>
      get<RoomSeatsResponse>(
        `/api/rooms/${encodeURIComponent(roomId)}/seats`,
        (b) => isObject(b) && Array.isArray(b.items) && typeof b.truncated === "boolean",
      ),
    get: (seatId: string) =>
      get<SeatDto>(
        `/api/seats/${encodeURIComponent(seatId)}`,
        (b) => isObject(b) && typeof b.id === "string" && Array.isArray(b.devices),
      ),
  };
}

export type SeatsApi = ReturnType<typeof createSeatsApi>;
