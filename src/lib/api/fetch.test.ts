import { describe, expect, it, vi } from "vitest";
import { ApiAccessError, createApiFetch } from "./fetch";

const res = (status: number, code?: string) =>
  new Response(code ? JSON.stringify({ error: { code } }) : "{}", { status });

function setup(
  answers: (() => Response | Promise<Response>)[],
  tokens: (string | null)[] = ["t1", "t2"],
) {
  const fetchFn = vi.fn(async (..._a: Parameters<typeof fetch>) => answers.shift()!());
  const queue = [...tokens];
  const getToken = vi.fn(async (_rejected?: string) => queue.shift() ?? null);
  const onAuthLost = vi.fn();
  const apiFetch = createApiFetch({
    getToken,
    fetchFn: fetchFn as unknown as typeof fetch,
    onAuthLost,
  });
  return { apiFetch, fetchFn, getToken, onAuthLost };
}
const reject = async (p: Promise<unknown>) =>
  (await p.then(
    () => null,
    (x: unknown) => x,
  )) as Error;
const sent = (fetchFn: ReturnType<typeof setup>["fetchFn"], i = 0) =>
  (fetchFn.mock.calls[i] as [string, RequestInit])[1];

describe("createApiFetch", () => {
  it("attaches Authorization: Bearer and cache: no-store; caller headers kept", async () => {
    const s = setup([() => res(200)]);
    await s.apiFetch("/api/me", { headers: { "X-Test": "1" } });
    expect((s.fetchFn.mock.calls[0] as [string])[0]).toBe("/api/me");
    expect(sent(s.fetchFn).cache).toBe("no-store");
    const headers = sent(s.fetchFn).headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer t1");
    expect(headers.get("X-Test")).toBe("1");
  });

  it("refuses a path outside /api/ and never puts the token in the URL", async () => {
    const s = setup([() => res(200)]);
    for (const bad of [
      "https://evil.test/api/x",
      "//evil.test/api/x",
      "api/x",
      "/apix",
      "/other",
    ]) {
      expect((await reject(s.apiFetch(bad))).message).toMatch(/\/api\//);
    }
    expect(s.fetchFn).not.toHaveBeenCalled();
    await s.apiFetch("/api/x?a=1");
    expect((s.fetchFn.mock.calls[0] as [string])[0]).toBe("/api/x?a=1");
  });

  it("signed out (getToken -> null) throws signed_out and sends nothing", async () => {
    const s = setup([], [null]);
    expect(await reject(s.apiFetch("/api/me"))).toMatchObject({ code: "signed_out" });
    expect(s.fetchFn).not.toHaveBeenCalled();
  });

  it("401 -> getToken(rejected) once, one retry, 200 returned", async () => {
    const s = setup([() => res(401, "unauthenticated"), () => res(200)]);
    expect((await s.apiFetch("/api/me")).status).toBe(200);
    expect(s.getToken.mock.calls).toEqual([[], ["t1"]]);
    expect(s.fetchFn).toHaveBeenCalledTimes(2);
    expect((sent(s.fetchFn, 1).headers as Headers).get("Authorization")).toBe("Bearer t2");
  });

  it("403 forbidden -> one re-mint, one retry, 200 returned", async () => {
    const s = setup([() => res(403, "forbidden"), () => res(200)]);
    expect((await s.apiFetch("/api/me")).status).toBe(200);
    expect(s.getToken.mock.calls).toEqual([[], ["t1"]]);
  });

  it("403 then 403 -> exactly one retry, throws forbidden", async () => {
    const s = setup([() => res(403, "forbidden"), () => res(403, "forbidden")]);
    const err = await reject(s.apiFetch("/api/me"));
    expect(err).toBeInstanceOf(ApiAccessError);
    expect(err).toMatchObject({ code: "forbidden" });
    expect(s.fetchFn).toHaveBeenCalledTimes(2);
    expect(s.getToken).toHaveBeenCalledTimes(2);
  });

  it("403 member_deactivated twice -> member_deactivated", async () => {
    const s = setup([() => res(403, "member_deactivated"), () => res(403, "member_deactivated")]);
    expect(await reject(s.apiFetch("/api/me"))).toMatchObject({ code: "member_deactivated" });
  });

  it("403 org_required is not retried", async () => {
    const s = setup([() => res(403, "org_required")]);
    expect(await reject(s.apiFetch("/api/me"))).toMatchObject({ code: "org_required" });
    expect(s.fetchFn).toHaveBeenCalledTimes(1);
    expect(s.getToken).toHaveBeenCalledTimes(1);
  });

  it("401 after the retry -> onAuthLost once, throws unauthenticated", async () => {
    const s = setup([() => res(401, "unauthenticated"), () => res(401, "unauthenticated")]);
    expect(await reject(s.apiFetch("/api/me"))).toMatchObject({ code: "unauthenticated" });
    expect(s.onAuthLost).toHaveBeenCalledTimes(1);
  });

  it("sends redirect: error on first send and retry, even if the caller asks for follow", async () => {
    const s = setup([() => res(401, "unauthenticated"), () => res(200)]);
    await s.apiFetch("/api/me", { redirect: "follow" });
    expect(sent(s.fetchFn, 0).redirect).toBe("error");
    expect(sent(s.fetchFn, 1).redirect).toBe("error");
  });

  it("a rejected fetch (redirect refused) propagates, no onAuthLost", async () => {
    const s = setup([() => Promise.reject(new TypeError("redirect mode is set to error"))]);
    expect(await reject(s.apiFetch("/api/me"))).toBeInstanceOf(TypeError);
    expect(s.fetchFn).toHaveBeenCalledTimes(1);
    expect(s.onAuthLost).not.toHaveBeenCalled();
  });

  it("403 with an unknown or unreadable body is treated as forbidden", async () => {
    const s = setup([() => res(403, "weird"), () => new Response("not json", { status: 403 })]);
    expect(await reject(s.apiFetch("/api/me"))).toMatchObject({ code: "forbidden" });
  });

  it("503, 500 and a network TypeError pass through: no re-mint, no onAuthLost", async () => {
    for (const status of [503, 500]) {
      const s = setup([() => res(status)]);
      expect((await s.apiFetch("/api/me")).status).toBe(status);
      expect(s.getToken).toHaveBeenCalledTimes(1);
      expect(s.onAuthLost).not.toHaveBeenCalled();
    }
    const down = setup([() => Promise.reject(new TypeError("offline"))]);
    expect(await reject(down.apiFetch("/api/me"))).toBeInstanceOf(TypeError);
    expect(down.getToken).toHaveBeenCalledTimes(1);
    expect(down.onAuthLost).not.toHaveBeenCalled();
  });

  it("getToken rejecting (session_invalid) propagates; nothing is retried", async () => {
    const s = setup([() => res(401, "unauthenticated")]);
    s.getToken.mockResolvedValueOnce("t1").mockRejectedValueOnce({ code: "session_invalid" });
    expect(await reject(s.apiFetch("/api/me"))).toMatchObject({ code: "session_invalid" });
    expect(s.fetchFn).toHaveBeenCalledTimes(1);
  });

  it("a ReadableStream body is never retried; string and FormData bodies are resent", async () => {
    const s = setup([() => res(403, "forbidden")]);
    const init = { method: "POST", body: new ReadableStream(), duplex: "half" } as RequestInit;
    expect(await reject(s.apiFetch("/api/x", init))).toMatchObject({ code: "forbidden" });
    expect(s.fetchFn).toHaveBeenCalledTimes(1);

    const t = setup([() => res(401), () => res(200)]);
    await t.apiFetch("/api/x", { method: "POST", body: "{}" });
    expect(sent(t.fetchFn, 1).body).toBe("{}");
    const fd = new FormData();
    const u = setup([() => res(401), () => res(200)]);
    await u.apiFetch("/api/x", { method: "POST", body: fd });
    expect(sent(u.fetchFn, 1).body).toBe(fd);
  });
});
