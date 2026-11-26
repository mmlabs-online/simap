import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import type { MemberPhotoDto } from "@/lib/members/photo";
import { PHOTO_MIME, type PhotoType } from "@/lib/validate/photo";

export type PhotoApiResult<T> = { ok: true; value: T } | { ok: false; code: string };

const fail = (code: string): { ok: false; code: string } => ({ ok: false, code });
const PATH = "/api/me/photo";

async function errorCode(res: Response): Promise<string> {
  try {
    const code = ((await res.json()) as { error?: { code?: unknown } } | null)?.error?.code;
    return typeof code === "string" ? code : "internal";
  } catch {
    return "internal";
  }
}

/** Own-photo calls through the one bearer `apiFetch`. Every method resolves to a result and never throws. */
export function createPhotoApi(fetcher: ApiFetch) {
  async function call<T>(
    init: RequestInit,
    read: (res: Response) => Promise<PhotoApiResult<T>>,
    okOn404 = false,
  ): Promise<PhotoApiResult<T>> {
    let res: Response;
    try {
      res = await fetcher(PATH, init);
    } catch (e) {
      if (e instanceof ApiAccessError) {
        return fail(e.code === "signed_out" ? "unauthenticated" : e.code);
      }
      return fail("unavailable");
    }
    if (okOn404 && res.status === 404) return { ok: true, value: null as T };
    if (!res.ok) return fail(await errorCode(res));
    try {
      return await read(res);
    } catch {
      return fail("internal");
    }
  }

  return {
    /** The own photo, or `null` when there is none (a 404 is not an error). */
    get: () =>
      call<Blob | null>(
        { method: "GET" },
        async (res) => {
          const blob = await res.blob();
          return blob.type === "image/png" || blob.type === "image/jpeg"
            ? { ok: true, value: blob }
            : fail("internal");
        },
        true,
      ),
    put: (bytes: Uint8Array<ArrayBuffer>, type: PhotoType) =>
      call<MemberPhotoDto>(
        {
          method: "PUT",
          headers: { "content-type": PHOTO_MIME[type] },
          body: new Blob([bytes], { type: PHOTO_MIME[type] }),
        },
        async (res) => ({ ok: true, value: (await res.json()) as MemberPhotoDto }),
      ),
    remove: () => call<null>({ method: "DELETE" }, async () => ({ ok: true, value: null })),
  };
}

export type PhotoApi = ReturnType<typeof createPhotoApi>;
