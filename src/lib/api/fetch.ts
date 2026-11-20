/** Why `apiFetch` gave up. `signed_out`: no session; the others mirror the API error codes. */
export type ApiAccessCode =
  | "signed_out"
  | "unauthenticated"
  | "org_required"
  | "forbidden"
  | "member_deactivated";

export class ApiAccessError extends Error {
  constructor(readonly code: ApiAccessCode) {
    super(code);
    this.name = "ApiAccessError";
  }
}

/** `rejected`: the token a request just got 401/403 for, so the store re-mints instead of reusing it. */
export type GetToken = (rejected?: string) => Promise<string | null>;

const ACCESS_CODES: readonly string[] = ["org_required", "forbidden", "member_deactivated"];

async function accessCodeOf(res: Response): Promise<ApiAccessCode> {
  try {
    const code = ((await res.clone().json()) as { error?: { code?: unknown } } | null)?.error?.code;
    if (typeof code === "string" && ACCESS_CODES.includes(code)) return code as ApiAccessCode;
  } catch {
    // unreadable body: fail closed
  }
  return "forbidden";
}

const isStream = (body: unknown) =>
  typeof ReadableStream !== "undefined" && body instanceof ReadableStream;

/**
 * The one bearer path for UI data calls to `/api/*`. On a 401, or a 403 other than `org_required`, it re-mints the
 * token once and resends once (D7). 5xx and network errors are returned or thrown untouched: no sign-out (AUT-02).
 */
export function createApiFetch({
  getToken,
  fetchFn = (...a) => fetch(...a),
  onAuthLost,
}: {
  getToken: GetToken;
  fetchFn?: typeof fetch;
  onAuthLost: () => void;
}) {
  return async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
    if (!input.startsWith("/api/")) throw new Error("apiFetch only calls /api/ paths");
    const send = (token: string) => {
      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${token}`);
      return fetchFn(input, { ...init, headers, cache: "no-store" });
    };
    const first = await getToken();
    if (first === null) throw new ApiAccessError("signed_out");
    let res = await send(first);
    if (res.status !== 401 && res.status !== 403) return res;

    let code: ApiAccessCode | null = null;
    if (res.status === 403) {
      code = await accessCodeOf(res);
      if (code === "org_required") throw new ApiAccessError(code);
    }
    if (isStream(init.body))
      throw new ApiAccessError(res.status === 401 ? "unauthenticated" : code!);

    const second = await getToken(first);
    if (second === null) throw new ApiAccessError("signed_out");
    res = await send(second);
    if (res.status === 401) {
      onAuthLost();
      throw new ApiAccessError("unauthenticated");
    }
    if (res.status === 403) throw new ApiAccessError(await accessCodeOf(res));
    return res;
  };
}

export type ApiFetch = ReturnType<typeof createApiFetch>;
