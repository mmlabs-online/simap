import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import type {
  DeactivationImpact,
  MemberDto,
  MemberListResponse,
  PendingInvitationDto,
} from "@/lib/members/types";
import type { MemberPatchValue } from "@/lib/validate/member";
import type { MemberQuery } from "./members-state";

export type MembersResult<T> = { ok: true; value: T } | { ok: false; code: string };

const fail = (code: string): { ok: false; code: string } => ({ ok: false, code });

async function errorCode(res: Response): Promise<string> {
  try {
    const code = ((await res.json()) as { error?: { code?: unknown } } | null)?.error?.code;
    return typeof code === "string" ? code : "internal";
  } catch {
    return "internal";
  }
}

/** Member calls through the one bearer `apiFetch`. Every method resolves to a result and never throws. */
export function createMembersApi(fetcher: ApiFetch) {
  async function call<T>(
    path: string,
    init: RequestInit,
    read: (res: Response) => Promise<MembersResult<T>>,
  ): Promise<MembersResult<T>> {
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

  const json = <T>(res: Response): Promise<MembersResult<T>> =>
    res.json().then((value: T) => ({ ok: true as const, value }));
  const withBody = (body: unknown): RequestInit => ({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const memberPath = (id: string) => `/api/members/${encodeURIComponent(id)}`;

  return {
    list: (query: MemberQuery, cursor?: string) => {
      const p = new URLSearchParams({ status: query.status, limit: String(query.limit) });
      if (query.q.trim() !== "") p.set("q", query.q);
      if (cursor) p.set("cursor", cursor);
      return call<MemberListResponse>(`/api/members?${p}`, { method: "GET" }, async (res) => {
        const b = (await res.json()) as Partial<MemberListResponse> | null;
        const ok =
          Array.isArray(b?.items) &&
          Array.isArray(b?.groups) &&
          (b.nextCursor === null || typeof b.nextCursor === "string");
        return ok ? { ok: true, value: b as MemberListResponse } : fail("internal");
      });
    },
    update: (id: string, patch: MemberPatchValue) =>
      call<MemberDto>(memberPath(id), { ...withBody(patch), method: "PATCH" }, json<MemberDto>),
    impact: (id: string) =>
      call<DeactivationImpact>(
        `${memberPath(id)}/deactivation-impact`,
        { method: "GET" },
        json<DeactivationImpact>,
      ),
    deactivate: (id: string, release: boolean) =>
      call<MemberDto>(`${memberPath(id)}/deactivate`, withBody({ release }), json<MemberDto>),
    reactivate: (id: string) =>
      call<MemberDto>(`${memberPath(id)}/reactivate`, { method: "POST" }, json<MemberDto>),
    invitations: () =>
      call<PendingInvitationDto[]>("/api/members/invitations", { method: "GET" }, async (res) => {
        const b = (await res.json()) as { items?: unknown } | null;
        return Array.isArray(b?.items)
          ? { ok: true, value: b.items as PendingInvitationDto[] }
          : fail("internal");
      }),
  };
}

export type MembersApi = ReturnType<typeof createMembersApi>;
