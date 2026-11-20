import { describe, expect, it, vi } from "vitest";
import { createIdentityClient } from "./identityClient";
import type { AuthError } from "@/lib/identity/types";

const ID = "11111111-1111-4111-8111-111111111111";
const BASE = "https://api.test/api/v1";
const json = (b: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
const setup = (res: () => Response | Promise<Response>) => {
  const fetchFn = vi.fn(async (..._a: Parameters<typeof fetch>) => res());
  const client = createIdentityClient({
    baseUrl: BASE,
    app: "simap",
    fetchFn: fetchFn as unknown as typeof fetch,
  });
  const req = () => {
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    return {
      url,
      init,
      headers: init.headers as Record<string, string>,
      body: JSON.parse(String(init.body)),
    };
  };
  return { client, fetchFn, req };
};
const tokenBody = {
  access_token: "tok-secret",
  token_type: "Bearer",
  expires_in: 900,
  audience: "simap",
};
const reject = async (p: Promise<unknown>) =>
  (await p.then(
    () => null,
    (e: unknown) => e,
  )) as AuthError;

describe("request shapes", () => {
  it("login", async () => {
    const { client, req } = setup(() =>
      json({ account_id: ID, user: { id: ID, email: "a@b.co" } }),
    );
    expect(await client.login({ email: "a@b.co", password: "pw" })).toEqual({
      accountId: ID,
      email: "a@b.co",
    });
    expect(req().url).toBe(`${BASE}/auth/login`);
    expect(req().init.method).toBe("POST");
    expect(req().init.credentials).toBe("include");
    expect(req().headers).toEqual({ "Content-Type": "application/json", "X-MM-App": "simap" });
    expect(req().body).toEqual({ email: "a@b.co", password: "pw" });
  });

  it("login sends turnstile_token only when given", async () => {
    const { client, req } = setup(() => json({ account_id: ID, user: { email: "a@b.co" } }));
    await client.login({ email: "a@b.co", password: "pw", turnstileToken: "ts" });
    expect(req().body).toEqual({ email: "a@b.co", password: "pw", turnstile_token: "ts" });
  });

  it("token carries an AbortSignal (15 s timeout)", async () => {
    const { client, req } = setup(() => json(tokenBody));
    await client.token(ID);
    expect(req().init.signal).toBeInstanceOf(AbortSignal);
  });

  it("token", async () => {
    const { client, req } = setup(() => json(tokenBody));
    expect(await client.token(ID)).toEqual({ accessToken: "tok-secret", expiresIn: 900 });
    expect(req().url).toBe(`${BASE}/auth/token`);
    expect(req().body).toEqual({ audience: "simap", account_id: ID });
    expect(req().init.credentials).toBe("include");
    expect(req().headers["X-MM-App"]).toBe("simap");
  });

  it("token accepts expires_in 43200 (D46)", async () => {
    const { client } = setup(() => json({ ...tokenBody, expires_in: 43200 }));
    expect(await client.token(ID)).toEqual({ accessToken: "tok-secret", expiresIn: 43200 });
  });

  it("logout and resend", async () => {
    const a = setup(() => new Response(null, { status: 204 }));
    await a.client.logout(ID);
    expect(a.req().url).toBe(`${BASE}/auth/logout`);
    expect(a.req().body).toEqual({ account_id: ID });
    expect(a.req().init.credentials).toBe("include");
    expect(a.req().init.signal).toBeInstanceOf(AbortSignal);
    const b = setup(() => json({}, 202));
    await b.client.resendVerification(ID);
    expect(b.req().url).toBe(`${BASE}/auth/verify-email/resend`);
    expect(b.req().body).toEqual({ account_id: ID });
    expect(b.req().headers["X-MM-App"]).toBe("simap");
  });

  it("signup", async () => {
    const { client, req } = setup(() => json({ id: ID, email: "a@b.co" }, 201));
    expect(await client.signup({ email: "a@b.co", password: "pw", turnstileToken: "ts" })).toEqual({
      email: "a@b.co",
    });
    expect(req().url).toBe(`${BASE}/auth/signup`);
    expect(req().init.credentials).toBe("omit");
    expect(req().headers["X-MM-App"]).toBe("simap");
    expect(req().body).toEqual({ email: "a@b.co", password: "pw", turnstile_token: "ts" });
  });

  it("verifyEmail is the public call: omit credentials, no app header, body only", async () => {
    const { client, req } = setup(() => new Response(null, { status: 204 }));
    await client.verifyEmail("tok-in-body");
    expect(req().url).toBe(`${BASE}/auth/verify-email`);
    expect(req().url).not.toContain("?");
    expect(req().init.credentials).toBe("omit");
    expect(req().headers).toEqual({ "Content-Type": "application/json" });
    expect(req().body).toEqual({ token: "tok-in-body" });
  });
});

describe("response validation", () => {
  const bad: [string, unknown][] = [
    ["non-UUID account", null],
    ["token_type", { ...tokenBody, token_type: "Basic" }],
    ["missing expires_in", { ...tokenBody, expires_in: undefined }],
    ["zero expires_in", { ...tokenBody, expires_in: 0 }],
    ["NaN expires_in", { ...tokenBody, expires_in: "NaN" }],
    ["huge expires_in", { ...tokenBody, expires_in: 10 ** 9 }],
    ["wrong audience", { ...tokenBody, audience: "other" }],
    ["empty token", { ...tokenBody, access_token: "" }],
  ];
  it.each(bad.slice(1))("token: %s -> unknown", async (_n, b) => {
    const { client } = setup(() => json(b));
    expect((await reject(client.token(ID))).code).toBe("unknown");
  });

  it("login: non-UUID account_id -> unknown", async () => {
    const { client } = setup(() => json({ account_id: "nope", user: { email: "a@b.co" } }));
    expect((await reject(client.login({ email: "a@b.co", password: "p" }))).code).toBe("unknown");
  });
});

describe("errors", () => {
  it("maps server errors and network failures", async () => {
    const a = setup(() => json({ error: { code: "not_member" } }, 403));
    expect((await reject(a.client.token(ID))).code).toBe("not_member");
    const b = setup(() => {
      throw new TypeError("Failed to fetch");
    });
    expect((await reject(b.client.token(ID))).code).toBe("network");
    const c = setup(() => json({ error: { code: "rate_limited" } }, 429, { "Retry-After": "30" }));
    expect(await reject(c.client.logout(ID))).toEqual({
      code: "rate_limited",
      retryAfterSeconds: 30,
    });
  });

  it("error objects never contain the token or password", async () => {
    const a = setup(() =>
      json({ error: { code: "invalid_credentials", message: "tok-in-body hunter2" } }, 401),
    );
    const e1 = await reject(a.client.verifyEmail("tok-in-body"));
    const b = setup(() => {
      throw new TypeError("hunter2 failed");
    });
    const e2 = await reject(b.client.login({ email: "a@b.co", password: "hunter2" }));
    for (const e of [e1, e2]) {
      expect(JSON.stringify(e)).not.toMatch(/tok-in-body|hunter2/);
      expect(String(e)).not.toMatch(/tok-in-body|hunter2/);
    }
  });
});

describe("join and accounts", () => {
  it("join: POST {BASE}/auth/apps/simap/join, credentials include, Content-Type + X-MM-App, body {account_id} only", async () => {
    const { client, req } = setup(() => json({ status: "member" }));
    await client.join(ID);
    expect(req().url).toBe(`${BASE}/auth/apps/simap/join`);
    expect(req().init.method).toBe("POST");
    expect(req().init.credentials).toBe("include");
    expect(req().headers).toEqual({ "Content-Type": "application/json", "X-MM-App": "simap" });
    expect(req().body).toEqual({ account_id: ID });
  });

  it("join: 200 member / 202 pending resolve; other bodies (missing or unknown status, non-JSON) -> unknown", async () => {
    expect(await setup(() => json({ status: "member" })).client.join(ID)).toBe("member");
    expect(await setup(() => json({ status: "pending" }, 202)).client.join(ID)).toBe("pending");
    for (const res of [
      () => json({}),
      () => json({ status: "other" }),
      () => new Response("not json", { status: 200 }),
    ]) {
      expect(await reject(setup(res).client.join(ID))).toEqual({ code: "unknown" });
    }
  });

  it("join errors: join_closed / join_rejected / join_queue_full / join_unavailable / email_unverified / session_invalid mapped; app_mismatch -> unknown; fetch throw -> network", async () => {
    const codes = [
      "join_closed",
      "join_rejected",
      "join_queue_full",
      "join_unavailable",
      "email_unverified",
      "session_invalid",
    ];
    for (const code of codes) {
      const { client } = setup(() => json({ error: { code } }, 403));
      expect(await reject(client.join(ID))).toEqual({ code });
    }
    const mismatch = setup(() => json({ error: { code: "app_mismatch" } }, 403));
    expect(await reject(mismatch.client.join(ID))).toEqual({ code: "unknown" });
    const down = setup(() => Promise.reject(new TypeError("offline")));
    expect(await reject(down.client.join(ID))).toEqual({ code: "network" });
  });

  it("accounts: GET {BASE}/auth/accounts, credentials include, X-MM-App, no body, no-store", async () => {
    const { client, fetchFn } = setup(() => json({ items: [] }));
    expect(await client.accounts()).toEqual([]);
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/auth/accounts`);
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("include");
    expect(init.headers).toEqual({ "X-MM-App": "simap" });
    expect(init.body).toBeUndefined();
    expect(init.cache).toBe("no-store");
  });

  it("accounts carries an AbortSignal (5 s timeout); a rejected fetch -> network", async () => {
    const { client, fetchFn } = setup(() => json({ items: [] }));
    await client.accounts();
    expect((fetchFn.mock.calls[0] as [string, RequestInit])[1].signal).toBeInstanceOf(AbortSignal);
    const down = setup(() => Promise.reject(new DOMException("timeout", "TimeoutError")));
    expect(await reject(down.client.accounts())).toEqual({ code: "network" });
  });

  it("accounts: drops items with a non-UUID account_id or a non-string/empty email; non-array items -> []; Vietnamese/IDN email kept as-is", async () => {
    const items = [
      { account_id: ID, email: "nguyễn.thị@bücher.example" },
      { account_id: "nope", email: "a@b.co" },
      { account_id: ID, email: "" },
      { account_id: ID, email: 5 },
      null,
    ];
    const { client } = setup(() => json({ items }));
    expect(await client.accounts()).toEqual([
      { accountId: ID, email: "nguyễn.thị@bücher.example" },
    ]);
    expect(await setup(() => json({ items: "x" })).client.accounts()).toEqual([]);
    expect(
      await reject(
        setup(() => json({ error: { code: "session_invalid" } }, 401)).client.accounts(),
      ),
    ).toEqual({ code: "session_invalid" });
  });
});

describe("forgotPassword", () => {
  const call = (c: ReturnType<typeof setup>["client"]) =>
    c.forgotPassword({ email: "a@b.co", turnstileToken: "ts" });

  it("is an app-header call without cookies, with exactly {email, turnstile_token}", async () => {
    const { client, req } = setup(() => new Response(null, { status: 202 }));
    await expect(call(client)).resolves.toBeUndefined();
    expect(req().url).toBe(`${BASE}/auth/password/forgot`);
    expect(req().init.method).toBe("POST");
    expect(req().init.credentials).toBe("omit");
    expect(req().headers).toEqual({ "Content-Type": "application/json", "X-MM-App": "simap" });
    expect(req().body).toEqual({ email: "a@b.co", turnstile_token: "ts" });
  });

  it("maps errors", async () => {
    expect(
      await reject(call(setup(() => json({ error: { code: "turnstile_failed" } }, 403)).client)),
    ).toEqual({ code: "turnstile_failed" });
    expect(
      await reject(call(setup(() => json({ error: { code: "origin_not_allowed" } }, 403)).client)),
    ).toEqual({ code: "unknown" });
    const limited = await reject(
      call(
        setup(() => json({ error: { code: "rate_limited" } }, 429, { "Retry-After": "60" })).client,
      ),
    );
    expect(limited).toMatchObject({ code: "rate_limited", retryAfterSeconds: 60 });
  });
});

describe("resetPassword", () => {
  const call = (c: ReturnType<typeof setup>["client"]) =>
    c.resetPassword({ token: "tok-in-body", newPassword: "new password 123" });

  it("is the public call: omit credentials, no app header, body only", async () => {
    const { client, req } = setup(() => new Response(null, { status: 204 }));
    await expect(call(client)).resolves.toBeUndefined();
    expect(req().url).toBe(`${BASE}/auth/password/reset`);
    expect(req().url).not.toContain("?");
    expect(req().init.method).toBe("POST");
    expect(req().init.credentials).toBe("omit");
    expect(req().headers).toEqual({ "Content-Type": "application/json" });
    expect(req().body).toEqual({ token: "tok-in-body", new_password: "new password 123" });
  });

  it("maps weak_password with reasons and token_invalid", async () => {
    const weak = await reject(
      call(
        setup(() =>
          json({ error: { code: "weak_password", details: { reasons: ["too_common"] } } }, 422),
        ).client,
      ),
    );
    expect(weak).toMatchObject({ code: "weak_password", reasons: ["too_common"] });
    expect(
      await reject(call(setup(() => json({ error: { code: "token_invalid" } }, 422)).client)),
    ).toEqual({ code: "token_invalid" });
  });
});

describe("credentials and X-MM-App per call", () => {
  const ok = () =>
    json({ account_id: ID, user: { email: "a@b.co" }, ...tokenBody, status: "member", items: [] });
  const calls: [
    string,
    (c: ReturnType<typeof setup>["client"]) => Promise<unknown>,
    "include" | "omit",
    boolean,
  ][] = [
    ["login", (c) => c.login({ email: "a@b.co", password: "pw" }), "include", true],
    ["token", (c) => c.token(ID), "include", true],
    ["accounts", (c) => c.accounts(), "include", true],
    ["join", (c) => c.join(ID), "include", true],
    ["logout", (c) => c.logout(ID), "include", true],
    ["resend", (c) => c.resendVerification(ID), "include", true],
    [
      "signup",
      (c) => c.signup({ email: "a@b.co", password: "pw", turnstileToken: "ts" }),
      "omit",
      true,
    ],
    ["forgot", (c) => c.forgotPassword({ email: "a@b.co", turnstileToken: "ts" }), "omit", true],
    ["verify-email", (c) => c.verifyEmail("t"), "omit", false],
    ["reset", (c) => c.resetPassword({ token: "t", newPassword: "pw" }), "omit", false],
  ];
  it.each(calls)("%s", async (_n, run, credentials, app) => {
    const { client, fetchFn } = setup(ok);
    await run(client);
    const init = (fetchFn.mock.calls[0] as [string, RequestInit])[1];
    expect(init.credentials).toBe(credentials);
    const headers = init.headers as Record<string, string>;
    expect(headers["X-MM-App"]).toBe(app ? "simap" : undefined);
  });
});

describe("orgs and token with an org", () => {
  const ORG = "22222222-2222-4222-8222-222222222222";
  const ORG2 = "33333333-3333-4333-8333-333333333333";
  const list = [
    { id: ORG, name: "Alpha" },
    { id: ORG2, name: "Beta" },
  ];
  const expected = [
    { id: ORG, name: "Alpha" },
    { id: ORG2, name: "Beta" },
  ];

  it("orgs: GET {BASE}/auth/orgs?account_id=, credentials include, X-MM-App, no Authorization, no body, no-store, 5 s signal", async () => {
    const { client, fetchFn } = setup(() => json([]));
    expect(await client.orgs(ID)).toEqual([]);
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/auth/orgs?account_id=${ID}`);
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("include");
    expect(init.headers).toEqual({ "X-MM-App": "simap" });
    expect(init.body).toBeUndefined();
    expect(init.cache).toBe("no-store");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("orgs: bare array, items, orgs, organizations and data all parse to the same list", async () => {
    for (const body of [
      list,
      { items: list },
      { orgs: list },
      { organizations: list },
      { data: list },
    ]) {
      expect(await setup(() => json(body)).client.orgs(ID)).toEqual(expected);
    }
  });

  it("orgs: id and name from the supported keys; ids lowercased; names trimmed and NFC; duplicates and non-UUID ids dropped", async () => {
    const body = [
      { org_id: ORG.toUpperCase(), name: "  Tổ chức  ".normalize("NFD") },
      { organization_id: ORG2, display_name: "Beta" },
      { org: { id: "44444444-4444-4444-8444-444444444444", name: "Nested" }, roles: ["admin"] },
      { organization: { id: "55555555-5555-4555-8555-555555555555", slug: "slug-only" } },
      { id: ORG, name: "Duplicate" },
      { id: "nope", name: "Bad id" },
    ];
    expect(await setup(() => json({ items: body })).client.orgs(ID)).toEqual([
      { id: ORG, name: "Tổ chức" },
      { id: ORG2, name: "Beta" },
      { id: "44444444-4444-4444-8444-444444444444", name: "Nested" },
      { id: "55555555-5555-4555-8555-555555555555", name: "slug-only" },
    ]);
  });

  it("orgs: an unreadable body rejects unknown, never an empty list", async () => {
    for (const body of [{}, null, "x", { items: "x" }, [{ nope: 1 }], [{ id: "bad", name: "A" }]]) {
      expect(await reject(setup(() => json(body)).client.orgs(ID))).toEqual({ code: "unknown" });
    }
    expect(
      await reject(setup(() => new Response("<html>", { status: 200 })).client.orgs(ID)),
    ).toEqual({ code: "unknown" });
  });

  it("orgs: 401 session_invalid is mapped; a rejected fetch -> network", async () => {
    expect(
      await reject(setup(() => json({ error: { code: "session_invalid" } }, 401)).client.orgs(ID)),
    ).toEqual({ code: "session_invalid" });
    const down = setup(() => Promise.reject(new TypeError("offline")));
    expect(await reject(down.client.orgs(ID))).toEqual({ code: "network" });
  });

  it("token: body is {audience, account_id} without an org and adds org_id with one", async () => {
    const plain = setup(() => json(tokenBody));
    await plain.client.token(ID);
    expect(plain.req().body).toEqual({ audience: "simap", account_id: ID });
    const withOrg = setup(() => json(tokenBody));
    await withOrg.client.token(ID, ORG);
    expect(withOrg.req().body).toEqual({ audience: "simap", account_id: ID, org_id: ORG });
  });

  it("token: 403 org_access_denied -> {code: org_access_denied}", async () => {
    const { client } = setup(() => json({ error: { code: "org_access_denied" } }, 403));
    expect(await reject(client.token(ID, ORG))).toEqual({ code: "org_access_denied" });
  });
});
