import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import { parsePixelLook, type PixelLook } from "@/lib/sprites/pixel-look";

export type PixelLookResult<T> = { ok: true; value: T } | { ok: false; code: string };

const fail = (code: string): { ok: false; code: string } => ({ ok: false, code });

async function errorCode(res: Response): Promise<string> {
  try {
    const code = ((await res.json()) as { error?: { code?: unknown } } | null)?.error?.code;
    return typeof code === "string" ? code : "internal";
  } catch {
    return "internal";
  }
}

/** The stored-look body `{ look }`: a valid look, or null when none is stored. Anything else is `internal`. */
async function readLook(res: Response): Promise<PixelLookResult<PixelLook | null>> {
  const look = ((await res.json()) as { look?: unknown } | null)?.look;
  if (look === null) return { ok: true, value: null };
  const parsed = parsePixelLook(look);
  return parsed ? { ok: true, value: parsed } : fail("internal");
}

/** `/api/me/pixel-look` calls through the one bearer `apiFetch`. Every method resolves to a result and never throws. */
export function createPixelLookApi(fetcher: ApiFetch) {
  async function call<T>(
    init: RequestInit,
    read: (res: Response) => Promise<PixelLookResult<T>>,
  ): Promise<PixelLookResult<T>> {
    let res: Response;
    try {
      res = await fetcher("/api/me/pixel-look", init);
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

  return {
    get: () => call<PixelLook | null>({ method: "GET" }, readLook),
    save: (look: PixelLook) =>
      call<PixelLook>(
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            skin: look.skin,
            hair: look.hair,
            style: look.style,
            shirt: look.shirt,
          }),
        },
        async (res) => {
          const r = await readLook(res);
          return r.ok && r.value === null ? fail("internal") : (r as PixelLookResult<PixelLook>);
        },
      ),
    reset: () => call<null>({ method: "DELETE" }, async () => ({ ok: true, value: null })),
  };
}

export type PixelLookApi = ReturnType<typeof createPixelLookApi>;
