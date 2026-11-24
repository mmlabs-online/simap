import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import type { SearchGroup } from "@/lib/search/types";
import { GROUP_KIND, type AllGroups, type GroupKey, type SearchResult } from "./search-state";

const fail = (code: string): { ok: false; code: string } => ({ ok: false, code });

async function errorCode(res: Response): Promise<string> {
  try {
    const code = ((await res.json()) as { error?: { code?: unknown } } | null)?.error?.code;
    return typeof code === "string" ? code : "internal";
  } catch {
    return "internal";
  }
}

function readGroup<T>(v: unknown): SearchGroup<T> | null {
  const o = v as { items?: unknown; nextCursor?: unknown } | null;
  if (typeof o !== "object" || o === null || !Array.isArray(o.items)) return null;
  if (o.nextCursor !== null && typeof o.nextCursor !== "string") return null;
  return { items: o.items as T[], nextCursor: o.nextCursor };
}

/** Search calls through the one bearer `apiFetch`. Every method resolves to a result and never throws. */
export function createSearchApi(fetcher: ApiFetch) {
  async function call<T>(
    params: URLSearchParams,
    read: (body: unknown) => T | null,
  ): Promise<SearchResult<T>> {
    let res: Response;
    try {
      res = await fetcher(`/api/search?${params.toString()}`, { method: "GET" });
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
    /** First page of every group. */
    searchAll: (q: string) =>
      call<AllGroups>(new URLSearchParams({ q, kind: "all" }), (b) => {
        const o = b as { seats?: unknown; devices?: unknown; members?: unknown } | null;
        const seats = readGroup<AllGroups["seats"]["items"][number]>(o?.seats);
        const devices = readGroup<AllGroups["devices"]["items"][number]>(o?.devices);
        const members = readGroup<AllGroups["members"]["items"][number]>(o?.members);
        return seats && devices && members ? { seats, devices, members } : null;
      }),
    /** The next page of one group. */
    searchMore: (group: GroupKey, q: string, cursor: string) =>
      call<SearchGroup<AllGroups[GroupKey]["items"][number]>>(
        new URLSearchParams({ q, kind: GROUP_KIND[group], cursor }),
        (b) => readGroup((b as Record<string, unknown> | null)?.[group]),
      ),
  };
}

export type SearchApi = ReturnType<typeof createSearchApi>;
