import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import type { AuditFacets, AuditFilter, AuditPage } from "@/lib/audit/types";

export type AuditQuery = Omit<AuditFilter, "cursor">;
export type AuditResult<T> = { ok: true; value: T } | { ok: false; code: string };

const fail = (code: string): { ok: false; code: string } => ({ ok: false, code });

async function errorCode(res: Response): Promise<string> {
  try {
    const code = ((await res.json()) as { error?: { code?: unknown } } | null)?.error?.code;
    return typeof code === "string" ? code : "internal";
  } catch {
    return "internal";
  }
}

/** Audit calls through the one bearer `apiFetch`. Every method resolves to a result and never throws. */
export function createAuditApi(fetcher: ApiFetch) {
  async function call<T>(path: string, read: (body: unknown) => T | null): Promise<AuditResult<T>> {
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

  const isArray = (v: unknown) => Array.isArray(v);

  return {
    list: (query: AuditQuery, cursor?: string) => {
      const p = new URLSearchParams();
      if (query.actor) p.set("actor", query.actor);
      if (query.entity) p.set("entity", query.entity);
      if (query.from) p.set("from", query.from);
      if (query.to) p.set("to", query.to);
      p.set("limit", String(query.limit));
      if (cursor) p.set("cursor", cursor);
      return call<AuditPage>(`/api/audit?${p.toString()}`, (b) => {
        const o = b as { items?: unknown; nextCursor?: unknown } | null;
        if (!isArray(o?.items)) return null;
        if (o?.nextCursor !== null && typeof o?.nextCursor !== "string") return null;
        return { items: o.items as AuditPage["items"], nextCursor: o.nextCursor as string | null };
      });
    },
    facets: () =>
      call<AuditFacets>("/api/audit/facets", (b) => {
        const o = b as { actors?: unknown; entities?: unknown } | null;
        if (!isArray(o?.actors) || !isArray(o?.entities)) return null;
        return { actors: o.actors as AuditFacets["actors"], entities: o.entities as string[] };
      }),
  };
}

export type AuditApi = ReturnType<typeof createAuditApi>;
