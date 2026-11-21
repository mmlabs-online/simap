import { ApiAccessError, accessCodeOf, type ApiFetch } from "./fetch";

/**
 * `apiFetch` for dev-token mode (SIM-028.1): the server adds the bearer, so the browser sends none and never
 * re-sends. A 401 or a 403 `org_required` tells the gate the token is no longer usable.
 */
export function createDevApiFetch({
  fetchFn = (...a) => fetch(...a),
  onAuthLost,
}: {
  fetchFn?: typeof fetch;
  onAuthLost: (code: "unauthenticated" | "org_required") => void;
}): ApiFetch {
  return async function devApiFetch(input: string, init: RequestInit = {}): Promise<Response> {
    if (!input.startsWith("/api/")) throw new Error("apiFetch only calls /api/ paths");
    const headers = new Headers(init.headers);
    headers.delete("Authorization");
    const res = await fetchFn(input, { ...init, headers, cache: "no-store", redirect: "error" });
    if (res.status === 401) {
      onAuthLost("unauthenticated");
      throw new ApiAccessError("unauthenticated");
    }
    if (res.status === 403) {
      const code = await accessCodeOf(res);
      if (code === "org_required") onAuthLost("org_required");
      throw new ApiAccessError(code);
    }
    return res;
  };
}
