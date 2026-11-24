import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import type { GroupDto, GroupImpact, ProjectDto, ProjectImpact } from "@/lib/groups/types";
import type {
  GroupCreateValue,
  GroupPatchValue,
  ProjectCreateValue,
  ProjectPatchValue,
} from "@/lib/validate/group";

export type GroupsResult<T> = { ok: true; value: T } | { ok: false; code: string };

const fail = (code: string): { ok: false; code: string } => ({ ok: false, code });

async function errorCode(res: Response): Promise<string> {
  try {
    const code = ((await res.json()) as { error?: { code?: unknown } } | null)?.error?.code;
    return typeof code === "string" ? code : "internal";
  } catch {
    return "internal";
  }
}

/** Group and project calls through the one bearer `apiFetch`. Every method resolves to a result and never throws. */
export function createGroupsApi(fetcher: ApiFetch) {
  async function call<T>(
    path: string,
    init: RequestInit,
    read: (res: Response) => Promise<GroupsResult<T>>,
  ): Promise<GroupsResult<T>> {
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

  const json = <T>(res: Response): Promise<GroupsResult<T>> =>
    res.json().then((value: T) => ({ ok: true as const, value }));
  const withBody = (method: string, body: unknown): RequestInit => ({
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  /** One resource kind: `segment` is the path part (`groups`), `listKey` the key of the list response. */
  function resource<Dto, Create, Patch, Impact>(segment: string, listKey: string) {
    const base = `/api/${segment}`;
    const itemPath = (id: string) => `${base}/${encodeURIComponent(id)}`;
    return {
      list: () =>
        call<Dto[]>(base, { method: "GET" }, async (res) => {
          const list = ((await res.json()) as Record<string, unknown> | null)?.[listKey];
          return Array.isArray(list) ? { ok: true, value: list as Dto[] } : fail("internal");
        }),
      create: (body: Create) => call<Dto>(base, withBody("POST", body), json<Dto>),
      update: (id: string, patch: Patch) =>
        call<Dto>(itemPath(id), withBody("PATCH", patch), json<Dto>),
      impact: (id: string) =>
        call<Impact>(`${itemPath(id)}/delete-impact`, { method: "GET" }, json<Impact>),
      remove: (id: string, force: boolean) =>
        call<null>(
          `${itemPath(id)}${force ? "?force=true" : ""}`,
          { method: "DELETE" },
          async () => ({ ok: true, value: null }),
        ),
    };
  }

  return {
    groups: resource<GroupDto, GroupCreateValue, GroupPatchValue, GroupImpact>("groups", "groups"),
    projects: resource<ProjectDto, ProjectCreateValue, ProjectPatchValue, ProjectImpact>(
      "projects",
      "projects",
    ),
  };
}

export type GroupsApi = ReturnType<typeof createGroupsApi>;
