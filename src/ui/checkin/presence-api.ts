import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import type { MyPresenceDto, MyPresenceResponse, RoomPresenceResponse } from "@/lib/presence/types";

/** `room` is the room code a 409 `already_checked_in` names. */
export type PresenceResult<T> = { ok: true; value: T } | { ok: false; code: string; room?: string };

const fail = (code: string, room?: string): { ok: false; code: string; room?: string } =>
  room === undefined ? { ok: false, code } : { ok: false, code, room };

async function failure(res: Response) {
  try {
    const error = ((await res.json()) as { error?: { code?: unknown; room?: unknown } } | null)
      ?.error;
    const code = typeof error?.code === "string" ? error.code : "internal";
    return fail(code, typeof error?.room === "string" ? error.room : undefined);
  } catch {
    return fail("internal");
  }
}

const isObject = (b: unknown): b is Record<string, unknown> => typeof b === "object" && b !== null;

/**
 * Presence calls through the one bearer `apiFetch`. Every method resolves to a result and never throws.
 * Only idempotent writes are sent (PUT/DELETE/PATCH), so the single `apiFetch` re-send on 401/403 is safe.
 */
export function createPresenceApi(fetcher: ApiFetch) {
  async function call<T>(
    path: string,
    init: RequestInit,
    read: (body: unknown) => PresenceResult<T>,
  ): Promise<PresenceResult<T>> {
    let res: Response;
    try {
      res = await fetcher(path, init);
    } catch (e) {
      if (e instanceof ApiAccessError) {
        return fail(e.code === "signed_out" ? "unauthenticated" : e.code);
      }
      return fail("unavailable");
    }
    if (!res.ok) return failure(res);
    try {
      return read(await res.json());
    } catch {
      return fail("internal");
    }
  }

  const withBody = (method: string, body: unknown): RequestInit => ({
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const presenceOf = (b: unknown): PresenceResult<MyPresenceDto | null> =>
    isObject(b) && "presence" in b
      ? { ok: true, value: b.presence as MyPresenceDto | null }
      : fail("internal");

  return {
    mine: () =>
      call<MyPresenceResponse>("/api/me/presence", { method: "GET" }, (b) =>
        isObject(b) && typeof b.workDate === "string" && Array.isArray(b.recent)
          ? { ok: true, value: b as unknown as MyPresenceResponse }
          : fail("internal"),
      ),
    checkIn: (roomId: string) => call("/api/me/presence", withBody("PUT", { roomId }), presenceOf),
    checkOut: () => call("/api/me/presence", { method: "DELETE" }, presenceOf),
    move: (seatId: string) => call("/api/me/presence", withBody("PATCH", { seatId }), presenceOf),
    room: (roomId: string) =>
      call<RoomPresenceResponse>(
        `/api/rooms/${encodeURIComponent(roomId)}/presence`,
        { method: "GET" },
        (b) =>
          isObject(b) && Array.isArray(b.members)
            ? { ok: true, value: b as unknown as RoomPresenceResponse }
            : fail("internal"),
      ),
  };
}

export type PresenceApi = ReturnType<typeof createPresenceApi>;
