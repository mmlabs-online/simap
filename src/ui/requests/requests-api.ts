import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import {
  REQUEST_LIMITS,
  type MyRequestsPage,
  type RequestCreateResult,
  type RequestDto,
  type RequestPage,
  type RequestsSeenResult,
  type RequestStatus,
} from "@/lib/requests/types";

export type RequestsResult<T> = { ok: true; value: T } | { ok: false; code: string };

function isRequestDto(b: unknown): b is RequestDto {
  const o = b as { id?: unknown; status?: unknown } | null;
  return typeof o?.id === "string" && typeof o.status === "string";
}

const readDto = (b: unknown) => (isRequestDto(b) ? b : null);

const fail = (code: string): { ok: false; code: string } => ({ ok: false, code });

async function errorCode(res: Response): Promise<string> {
  try {
    const code = ((await res.json()) as { error?: { code?: unknown } } | null)?.error?.code;
    return typeof code === "string" ? code : "internal";
  } catch {
    return "internal";
  }
}

/** Request calls through the one bearer `apiFetch`. Every method resolves to a result and never throws. */
export function createRequestsApi(fetcher: ApiFetch) {
  async function call<T>(
    path: string,
    init: RequestInit,
    read: (body: unknown, status: number) => T | null,
  ): Promise<RequestsResult<T>> {
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
      const value = read(await res.json(), res.status);
      return value === null ? fail("internal") : { ok: true, value };
    } catch {
      return fail("internal");
    }
  }

  return {
    list: (status: RequestStatus, cursor?: string) => {
      const p = new URLSearchParams();
      p.set("status", status);
      p.set("limit", String(REQUEST_LIMITS.defaultLimit));
      if (cursor) p.set("cursor", cursor);
      return call<RequestPage>(`/api/requests?${p.toString()}`, { method: "GET" }, (b) => {
        const o = b as { items?: unknown; nextCursor?: unknown } | null;
        if (!Array.isArray(o?.items)) return null;
        if (o?.nextCursor !== null && typeof o?.nextCursor !== "string") return null;
        return {
          items: o.items as RequestPage["items"],
          nextCursor: o.nextCursor as string | null,
        };
      });
    },
    /** 201 = a new request; 200 = the same pending request already existed. */
    create: (seatId: string) =>
      call<RequestCreateResult>(
        "/api/requests",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ seatId }),
        },
        (b, status) => (isRequestDto(b) ? { created: status === 201, request: b } : null),
      ),
    cancel: (id: string) =>
      call<RequestDto>(
        `/api/requests/${encodeURIComponent(id)}/cancel`,
        { method: "POST" },
        readDto,
      ),
    approve: (id: string) =>
      call<RequestDto>(
        `/api/requests/${encodeURIComponent(id)}/approve`,
        { method: "POST" },
        readDto,
      ),
    reject: (id: string) =>
      call<RequestDto>(
        `/api/requests/${encodeURIComponent(id)}/reject`,
        { method: "POST" },
        readDto,
      ),
    mine: (cursor?: string, limit: number = REQUEST_LIMITS.defaultLimit) => {
      const p = new URLSearchParams();
      p.set("limit", String(limit));
      if (cursor) p.set("cursor", cursor);
      return call<MyRequestsPage>(`/api/requests/mine?${p.toString()}`, { method: "GET" }, (b) => {
        const o = b as { items?: unknown; nextCursor?: unknown; unseen?: unknown } | null;
        if (!Array.isArray(o?.items)) return null;
        if (o?.nextCursor !== null && typeof o?.nextCursor !== "string") return null;
        if (typeof o?.unseen !== "number" || !Number.isFinite(o.unseen)) return null;
        return {
          items: o.items as MyRequestsPage["items"],
          unseen: o.unseen,
          nextCursor: o.nextCursor as string | null,
        };
      });
    },
    /** `seenUpTo` is passed through untouched; the server treats an empty body as "now", so it is required. */
    markSeen: (seenUpTo: string) =>
      call<RequestsSeenResult>(
        "/api/requests/mine/seen",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ seenUpTo }),
        },
        (b) => {
          const o = b as { unseen?: unknown; requestsSeenAt?: unknown } | null;
          if (typeof o?.unseen !== "number" || !Number.isFinite(o.unseen)) return null;
          if (o.requestsSeenAt !== null && typeof o.requestsSeenAt !== "string") return null;
          return { unseen: o.unseen, requestsSeenAt: o.requestsSeenAt };
        },
      ),
  };
}

export type RequestsApi = ReturnType<typeof createRequestsApi>;
