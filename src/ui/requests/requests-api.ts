import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import { REQUEST_LIMITS, type RequestPage, type RequestStatus } from "@/lib/requests/types";

export type RequestsResult<T> = { ok: true; value: T } | { ok: false; code: string };

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
    read: (body: unknown) => T | null,
  ): Promise<RequestsResult<T>> {
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
      const value = read(await res.json());
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
      return call<RequestPage>(`/api/requests?${p.toString()}`, (b) => {
        const o = b as { items?: unknown; nextCursor?: unknown } | null;
        if (!Array.isArray(o?.items)) return null;
        if (o?.nextCursor !== null && typeof o?.nextCursor !== "string") return null;
        return {
          items: o.items as RequestPage["items"],
          nextCursor: o.nextCursor as string | null,
        };
      });
    },
  };
}

export type RequestsApi = ReturnType<typeof createRequestsApi>;
