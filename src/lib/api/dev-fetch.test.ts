import { describe, expect, it, vi } from "vitest";
import { createDevApiFetch } from "./dev-fetch";
import { ApiAccessError } from "./fetch";

const res = (status: number, code?: string) =>
  new Response(code ? JSON.stringify({ error: { code } }) : "{}", { status });

function setup(answer: () => Response | Promise<Response>) {
  const fetchFn = vi.fn(async (..._a: Parameters<typeof fetch>) => answer());
  const onAuthLost = vi.fn();
  const apiFetch = createDevApiFetch({ fetchFn: fetchFn as unknown as typeof fetch, onAuthLost });
  return { apiFetch, fetchFn, onAuthLost };
}
const reject = async (p: Promise<unknown>) =>
  (await p.then(
    () => null,
    (x: unknown) => x,
  )) as Error;
const sent = (fetchFn: ReturnType<typeof setup>["fetchFn"]) =>
  (fetchFn.mock.calls[0] as [string, RequestInit])[1];

describe("createDevApiFetch", () => {
  it("sends same-origin with no Authorization, even if the caller passes one; keeps other headers", async () => {
    const { apiFetch, fetchFn } = setup(() => res(200));
    await apiFetch("/api/me", { headers: { Authorization: "Bearer x", "X-A": "1" } });
    const headers = new Headers(sent(fetchFn).headers);
    expect(headers.has("Authorization")).toBe(false);
    expect(headers.get("X-A")).toBe("1");
    expect(fetchFn.mock.calls[0][0]).toBe("/api/me");
  });

  it("forces cache no-store and redirect error over caller values", async () => {
    const { apiFetch, fetchFn } = setup(() => res(200));
    await apiFetch("/api/me", { cache: "force-cache", redirect: "follow" });
    expect(sent(fetchFn)).toMatchObject({ cache: "no-store", redirect: "error" });
  });

  it("refuses non-/api/ input without sending", async () => {
    const { apiFetch, fetchFn } = setup(() => res(200));
    for (const input of ["https://x.invalid/api/me", "//host/api/x", "/apix"])
      expect((await reject(apiFetch(input))).message).toContain("/api/");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("401: one send, onAuthLost(unauthenticated), throws unauthenticated", async () => {
    const { apiFetch, fetchFn, onAuthLost } = setup(() => res(401));
    const e = await reject(apiFetch("/api/me"));
    expect(e).toBeInstanceOf(ApiAccessError);
    expect((e as ApiAccessError).code).toBe("unauthenticated");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(onAuthLost).toHaveBeenCalledWith("unauthenticated");
  });

  it("403 org_required: one send, onAuthLost(org_required), throws org_required", async () => {
    const { apiFetch, fetchFn, onAuthLost } = setup(() => res(403, "org_required"));
    const e = await reject(apiFetch("/api/me"));
    expect((e as ApiAccessError).code).toBe("org_required");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(onAuthLost).toHaveBeenCalledWith("org_required");
  });

  it("403 forbidden / member_deactivated / unreadable: one send, no onAuthLost, mapped code", async () => {
    for (const [r, code] of [
      [res(403, "forbidden"), "forbidden"],
      [res(403, "member_deactivated"), "member_deactivated"],
      [new Response("not json", { status: 403 }), "forbidden"],
    ] as const) {
      const { apiFetch, fetchFn, onAuthLost } = setup(() => r);
      expect(((await reject(apiFetch("/api/me"))) as ApiAccessError).code).toBe(code);
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(onAuthLost).not.toHaveBeenCalled();
    }
  });

  it("200, 400 and 5xx are returned untouched; a network error rethrows", async () => {
    for (const status of [200, 400, 503]) {
      const { apiFetch, fetchFn } = setup(() => res(status));
      expect((await apiFetch("/api/me")).status).toBe(status);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    }
    const boom = new TypeError("net");
    const { apiFetch } = setup(() => Promise.reject(boom));
    expect(await reject(apiFetch("/api/me"))).toBe(boom);
  });
});
