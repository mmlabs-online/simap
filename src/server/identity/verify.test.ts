import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  UnsecuredJWT,
  type CryptoKey,
  type JWK,
} from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createIdentityVerifier, MAX_TOKEN_CHARS, type VerifyCode } from "./verify";

const ISS = "https://api.mmlabs.online";
const SUB = "11111111-1111-4111-8111-111111111111";
const ORG = "22222222-2222-4222-8222-222222222222";
const ENUM = new Set<string>([
  "missing",
  "too_large",
  "malformed",
  "alg",
  "signature",
  "expired",
  "unknown_kid",
  "jwks_unavailable",
  "key_in_header",
  "email_unverified",
  "sub_invalid",
  "org_invalid",
  "org_roles_missing",
  "org_roles_invalid",
  "invalid",
  ...["iss", "aud", "typ", "iat", "nbf", "exp", "sub", "jti"].map((c) => `claim_${c}`),
]);

const now = () => Math.floor(Date.now() / 1000);
const bearer = (t: string) => `Bearer ${t}`;

async function keyPair(kid: string) {
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid, alg: "ES256", use: "sig" };
  return { privateKey, jwk };
}

type Claims = Record<string, unknown>;
function goodClaims(): Claims {
  return {
    iss: ISS,
    aud: "simap",
    sub: SUB,
    jti: "jti-secret-1",
    email: "someone@example.com",
    email_verified: true,
    org: ORG,
    org_roles: ["simap:manager"],
    iat: now(),
    exp: now() + 600,
  };
}

async function sign(
  privateKey: CryptoKey,
  claims: Claims,
  header: Record<string, unknown> = {},
  drop: string[] = [],
) {
  const c = { ...claims };
  for (const k of drop) delete c[k];
  return new SignJWT(c as never)
    .setProtectedHeader({ alg: "ES256", kid: "k1", typ: "at+jwt", ...header } as never)
    .sign(privateKey);
}

async function setup() {
  const k = await keyPair("k1");
  const other = await keyPair("k1");
  const getKey = createLocalJWKSet({ keys: [k.jwk] });
  let calls = 0;
  const jwks = ((h: never, t: never) => {
    calls++;
    return getKey(h, t);
  }) as typeof getKey;
  const verifier = createIdentityVerifier({ issuer: ISS, jwks });
  const check = async (token: string) => verifier.verify(bearer(token));
  const signed = (claims: Claims, header: Record<string, unknown> = {}, drop: string[] = []) =>
    sign(k.privateKey, claims, header, drop);
  return { k, other, verifier, check, signed, calls: () => calls };
}

const fail = (code: VerifyCode) => ({ ok: false, code });

const spies = () =>
  (["log", "error", "warn", "info", "debug"] as const).map((m) => vi.spyOn(console, m));

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("verifier", () => {
  it("happy path: returns sub, email, org, orgRoles", async () => {
    const { signed, check } = await setup();
    expect(await check(await signed(goodClaims()))).toEqual({
      ok: true,
      identity: {
        sub: SUB,
        email: "someone@example.com",
        org: ORG,
        orgRoles: ["simap:manager"],
        appRoles: [],
        orgAccess: null,
        lifetimeS: 600,
      },
    });
  });

  it("email absent, empty or non-string -> null", async () => {
    const { signed, check } = await setup();
    for (const email of [undefined, "", 42]) {
      const r = await check(await signed({ ...goodClaims(), email }));
      expect(r.ok && r.identity.email).toBeNull();
    }
  });

  it("alg HS256, RS256, ES384 -> alg; unsecured -> malformed; key getter never called", async () => {
    const { check, calls } = await setup();
    const hs = await new SignJWT(goodClaims() as never)
      .setProtectedHeader({ alg: "HS256", kid: "k1", typ: "at+jwt" })
      .sign(new TextEncoder().encode("x".repeat(32)));
    const none = new UnsecuredJWT(goodClaims() as never).encode();
    const rs = (await generateKeyPair("RS256", { modulusLength: 2048 })).privateKey;
    const rsTok = await new SignJWT(goodClaims() as never)
      .setProtectedHeader({ alg: "RS256", kid: "k1", typ: "at+jwt" })
      .sign(rs);
    const es384 = (await generateKeyPair("ES384")).privateKey;
    const es384Tok = await new SignJWT(goodClaims() as never)
      .setProtectedHeader({ alg: "ES384", kid: "k1", typ: "at+jwt" })
      .sign(es384);
    for (const t of [hs, rsTok, es384Tok]) expect(await check(t)).toEqual(fail("alg"));
    expect(await check(none)).toEqual(fail("malformed"));
    expect(calls()).toBe(0);
  });

  it("typ missing or JWT -> claim_typ", async () => {
    const { signed, check } = await setup();
    expect(await check(await signed(goodClaims(), { typ: "JWT" }))).toEqual(fail("claim_typ"));
    expect(await check(await signed(goodClaims(), { typ: undefined }))).toEqual(fail("claim_typ"));
  });

  it("iss variants (trailing slash, http, other host, prefix match) -> claim_iss", async () => {
    const { signed, check } = await setup();
    for (const iss of [
      "https://api.mmlabs.online.evil.com",
      "https://evil.com/https://api.mmlabs.online",
      "https://api.mmlabs.online/",
      "http://api.mmlabs.online",
    ]) {
      expect(await check(await signed({ ...goodClaims(), iss }))).toEqual(fail("claim_iss"));
    }
  });

  it("aud tudocuatui, array aud ['simap'] -> claim_aud", async () => {
    const { signed, check } = await setup();
    for (const aud of ["tudocuatui", ["simap"], ["simap", "x"]]) {
      expect(await check(await signed({ ...goodClaims(), aud }))).toEqual(fail("claim_aud"));
    }
  });

  it("expired beyond 30 s leeway; within leeway ok; iat in future; nbf; age > 12 h", async () => {
    const { signed, check } = await setup();
    const t = (c: Claims) => signed({ ...goodClaims(), ...c });
    expect(await check(await t({ exp: now() - 31 }))).toEqual(fail("expired"));
    expect((await check(await t({ exp: now() - 29, iat: now() - 100 }))).ok).toBe(true);
    expect(await check(await t({ iat: now() + 31 }))).toEqual(fail("claim_iat"));
    expect(await check(await t({ nbf: now() + 31 }))).toEqual(fail("claim_nbf"));
    const aged = (iat: number) => t({ iat, exp: now() + 600 });
    expect((await check(await aged(now() - 43140))).ok).toBe(true);
    expect(await check(await aged(now() - 43231))).toEqual(fail("expired"));
  });

  it("missing exp/iat/sub/jti/iss/aud and numeric or empty jti", async () => {
    const { signed, check } = await setup();
    for (const name of ["exp", "iat", "sub", "jti", "iss", "aud"]) {
      expect(await check(await signed(goodClaims(), {}, [name]))).toEqual(
        fail(`claim_${name}` as VerifyCode),
      );
    }
    for (const jti of [5, ""]) {
      expect(await check(await signed({ ...goodClaims(), jti }))).toEqual(fail("claim_jti"));
    }
  });

  it("unknown kid -> unknown_kid; same kid other key -> signature", async () => {
    const { other, signed, check } = await setup();
    expect(await check(await signed(goodClaims(), { kid: "nope" }))).toEqual(fail("unknown_kid"));
    expect(await check(await sign(other.privateKey, goodClaims()))).toEqual(fail("signature"));
  });

  it("jku/x5u/jwk/x5c in header -> key_in_header, getter not consulted, also with real kid", async () => {
    const { k, other, signed, check, calls } = await setup();
    const extras: Array<Record<string, unknown>> = [
      { jku: "https://evil.example/jwks.json" },
      { x5u: "https://evil.example/cert.pem" },
      { jwk: k.jwk },
      { x5c: ["MIIB"] },
      { jku: "" },
      { kid: "evil", jwk: other.jwk },
    ];
    for (const extra of extras) {
      expect(await check(await signed(goodClaims(), extra))).toEqual(fail("key_in_header"));
    }
    expect(calls()).toBe(0);
  });

  it("email_verified false, 'true', 1, missing -> email_unverified", async () => {
    const { signed, check } = await setup();
    for (const v of [false, "true", 1, undefined]) {
      expect(await check(await signed({ ...goodClaims(), email_verified: v }))).toEqual(
        fail("email_unverified"),
      );
    }
  });

  it("sub uppercase, padded, nil, non-UUID, number -> sub_invalid", async () => {
    const { signed, check } = await setup();
    for (const sub of [
      "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
      ` ${SUB} `,
      "00000000-0000-0000-0000-000000000000",
      "nope",
      7,
    ]) {
      expect(await check(await signed({ ...goodClaims(), sub }))).toEqual(fail("sub_invalid"));
    }
  });

  it("org present, org_roles missing -> org_roles_missing", async () => {
    const { signed, check } = await setup();
    expect(await check(await signed(goodClaims(), {}, ["org_roles"]))).toEqual(
      fail("org_roles_missing"),
    );
  });

  it("org_roles not an array or with a non-string -> org_roles_invalid", async () => {
    const { signed, check } = await setup();
    for (const org_roles of ["simap:admin", { a: 1 }, null, ["simap:admin", 1], [null]]) {
      expect(await check(await signed({ ...goodClaims(), org_roles }))).toEqual(
        fail("org_roles_invalid"),
      );
    }
  });

  it("org_roles without org -> org_roles_invalid", async () => {
    const { signed, check } = await setup();
    expect(await check(await signed(goodClaims(), {}, ["org"]))).toEqual(fail("org_roles_invalid"));
  });

  it("org uppercase / non-UUID / number -> org_invalid", async () => {
    const { signed, check } = await setup();
    for (const org of ["AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA", "acme", 5, null, ""]) {
      expect(await check(await signed({ ...goodClaims(), org }))).toEqual(fail("org_invalid"));
    }
  });

  it("no org -> ok with org null, orgRoles null", async () => {
    const { signed, check } = await setup();
    expect(await check(await signed(goodClaims(), {}, ["org", "org_roles"]))).toEqual({
      ok: true,
      identity: { sub: SUB, email: "someone@example.com", org: null, orgRoles: null },
    });
  });

  it("empty org_roles with org is well-formed", async () => {
    const { signed, check } = await setup();
    const r = await check(await signed({ ...goodClaims(), org_roles: [] }));
    expect(r.ok && r.identity.orgRoles).toEqual([]);
  });

  it("org present: roles and org_access are returned normalized (appRoles, orgAccess, lifetimeS = exp - iat)", async () => {
    const { signed, check } = await setup();
    const r = await check(
      await signed({
        ...goodClaims(),
        org_roles: [],
        roles: ["simap:super-admin"],
        org_access: "super_admin",
      }),
    );
    expect(r.ok && r.identity).toMatchObject({
      org: ORG,
      orgRoles: [],
      appRoles: ["simap:super-admin"],
      orgAccess: "super_admin",
      lifetimeS: 600,
    });
  });

  it("roles not an array, or with a non-string item -> token ok, appRoles []; org_access number/object -> orgAccess null", async () => {
    const { signed, check } = await setup();
    for (const roles of ["simap:super-admin", { a: 1 }, ["simap:super-admin", 1]]) {
      const r = await check(await signed({ ...goodClaims(), roles }));
      expect(r.ok && r.identity.appRoles).toEqual([]);
    }
    for (const org_access of [1, { a: 1 }]) {
      const r = await check(await signed({ ...goodClaims(), org_access }));
      expect(r.ok && r.identity.orgAccess).toBeNull();
    }
  });

  it("roles and org_access without org -> org null, no appRoles/orgAccess (unchanged no-org branch)", async () => {
    const { signed, check } = await setup();
    const claims = { ...goodClaims(), roles: ["simap:super-admin"], org_access: "super_admin" };
    const r = await check(await signed(claims, {}, ["org", "org_roles"]));
    expect(r).toEqual({
      ok: true,
      identity: { sub: SUB, email: "someone@example.com", org: null, orgRoles: null },
    });
  });

  it("org with org_roles [] and super-admin claims verifies; org without org_roles still org_roles_missing", async () => {
    const { signed, check } = await setup();
    const claims = { ...goodClaims(), org_roles: [], roles: ["simap:super-admin"] };
    expect((await check(await signed(claims))).ok).toBe(true);
    expect(await check(await signed(claims, {}, ["org_roles"]))).toEqual(fail("org_roles_missing"));
  });

  it("Authorization shapes: null, '', 'Basic x', 'Bearer', two tokens, lowercase bearer ok", async () => {
    const { signed, verifier } = await setup();
    const tok = await signed(goodClaims());
    expect(await verifier.verify(null)).toEqual(fail("missing"));
    expect(await verifier.verify("")).toEqual(fail("missing"));
    expect(await verifier.verify("Basic abc")).toEqual(fail("missing"));
    expect(await verifier.verify("Bearer")).toEqual(fail("missing"));
    expect(await verifier.verify("Bearer x")).toEqual(fail("malformed"));
    expect(await verifier.verify(`Bearer  ${tok}`)).toEqual(fail("malformed"));
    expect(await verifier.verify(`Bearer ${tok} ${tok}`)).toEqual(fail("malformed"));
    expect((await verifier.verify(`bearer ${tok}`)).ok).toBe(true);
  });

  it("a 6,000-char valid token verifies; header > 7 + 8192 -> too_large before key getter", async () => {
    const { signed, check, verifier, calls } = await setup();
    const big = await signed({
      ...goodClaims(),
      org_roles: [
        "simap:manager",
        ...Array.from({ length: 150 }, (_, i) => `other:role-${i}-x`.padEnd(30, "x")),
      ],
    });
    expect(big.length).toBeGreaterThan(5500);
    expect(big.length).toBeLessThan(MAX_TOKEN_CHARS);
    expect((await check(big)).ok).toBe(true);
    const before = calls();
    expect(await verifier.verify(`Bearer ${"a".repeat(MAX_TOKEN_CHARS + 1)}`)).toEqual(
      fail("too_large"),
    );
    expect(calls()).toBe(before);
  });

  it("failures are fixed codes from the enum and never log (console spies)", async () => {
    const logs = spies();
    const { k, signed, check } = await setup();
    const results = [
      await check("a.b.c"),
      await check(await signed({ ...goodClaims(), aud: "x" })),
      await check(await signed({ ...goodClaims(), email: "leak@example.com" }, {}, ["sub"])),
    ];
    for (const r of results) {
      expect(Object.keys(r).sort()).toEqual(["code", "ok"]);
      expect(ENUM.has((r as { code: string }).code)).toBe(true);
    }
    const down = createIdentityVerifier({
      issuer: ISS,
      jwks: (async () => {
        throw new Error("down");
      }) as never,
    });
    const unavailable = await down.verify(bearer(await sign(k.privateKey, goodClaims())));
    expect(Object.keys(unavailable).sort()).toEqual(["code", "ok", "unavailable"]);
    expect(ENUM.has((unavailable as { code: string }).code)).toBe(true);
    for (const l of logs) expect(l).not.toHaveBeenCalled();
    expect(JSON.stringify(results)).not.toContain("leak@example.com");
  });
});

describe("remote JWKS", () => {
  function jwksServer(initial: JWK[]) {
    const state = { keys: initial, fetches: [] as Array<{ url: string; ua: string | null }> };
    const fetchFn = (async (url: string | URL, init?: RequestInit) => {
      state.fetches.push({ url: String(url), ua: new Headers(init?.headers).get("user-agent") });
      return new Response(JSON.stringify({ keys: state.keys }), { status: 200 });
    }) as typeof fetch;
    return { state, fetchFn };
  }

  it("fetches lazily, honours the 60 s cooldown, picks up a rotated key", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2030-01-01T00:00:00Z") });
    const k1 = await keyPair("k1");
    const k2 = await keyPair("k2");
    const { state, fetchFn } = jwksServer([k1.jwk]);
    const v = createIdentityVerifier({ issuer: ISS, fetch: fetchFn });
    expect(state.fetches).toHaveLength(0);
    const t1 = await sign(k1.privateKey, goodClaims());
    const t2 = async () => sign(k2.privateKey, goodClaims(), { kid: "k2" });
    expect((await v.verify(bearer(t1))).ok).toBe(true);
    expect(state.fetches).toHaveLength(1);
    expect(state.fetches[0]).toEqual({
      url: `${ISS}/.well-known/jwks.json`,
      ua: "simap-server",
    });
    vi.setSystemTime(Date.now() + 1000);
    expect(await v.verify(bearer(await t2()))).toEqual(fail("unknown_kid"));
    expect(state.fetches).toHaveLength(1);
    vi.setSystemTime(Date.now() + 60_000);
    expect(await v.verify(bearer(await t2()))).toEqual(fail("unknown_kid"));
    expect(state.fetches).toHaveLength(2);
    vi.setSystemTime(Date.now() + 1000);
    await v.verify(bearer(await t2()));
    expect(state.fetches).toHaveLength(2);
    state.keys = [k1.jwk, k2.jwk];
    vi.setSystemTime(Date.now() + 60_000);
    expect((await v.verify(bearer(await t2()))).ok).toBe(true);
    expect(state.fetches).toHaveLength(3);
  });

  it("JWKS failures (fetch throws, 500, timeout) -> jwks_unavailable, unavailable: true", async () => {
    const k1 = await keyPair("k1");
    const tok = await sign(k1.privateKey, goodClaims());
    const responses: Array<() => Promise<Response>> = [
      () => Promise.reject(new TypeError("fetch failed")),
      async () => new Response("{}", { status: 500 }),
      async () => new Response("", { status: 301, headers: { location: "https://evil.example/" } }),
      async () => new Response("not json", { status: 200 }),
      async () => new Response(JSON.stringify({ nope: 1 }), { status: 200 }),
      (): Promise<Response> => new Promise(() => {}),
    ];
    for (const r of responses) {
      const fetchFn = ((_u: unknown, init?: RequestInit) =>
        init?.signal
          ? Promise.race([
              r(),
              new Promise<Response>((_, rej) =>
                init.signal!.addEventListener("abort", () =>
                  rej(Object.assign(new Error("t"), { name: "TimeoutError" })),
                ),
              ),
            ])
          : r()) as typeof fetch;
      const v = createIdentityVerifier({ issuer: ISS, fetch: fetchFn, timeoutMs: 50 });
      expect(await v.verify(bearer(tok))).toEqual({
        ok: false,
        code: "jwks_unavailable",
        unavailable: true,
      });
    }
  });

  it("rotated key during JWKS outage -> unavailable (not unknown_kid)", async () => {
    const k1 = await keyPair("k1");
    const k2 = await keyPair("k2");
    let down = false;
    const fetchFn = (async () => {
      if (down) throw new TypeError("fetch failed");
      return new Response(JSON.stringify({ keys: [k1.jwk] }), { status: 200 });
    }) as typeof fetch;
    const t2 = await sign(k2.privateKey, goodClaims(), { kid: "k2" });
    // Every clock read advances past the 60 s cooldown, so the unknown kid triggers a refetch that fails.
    const v2 = createIdentityVerifier({
      issuer: ISS,
      fetch: fetchFn,
      now: (() => {
        let t = 5_000_000;
        return () => (t += 61_000);
      })(),
    });
    expect((await v2.verify(bearer(await sign(k1.privateKey, goodClaims())))).ok).toBe(true);
    down = true;
    expect(await v2.verify(bearer(t2))).toEqual({
      ok: false,
      code: "jwks_unavailable",
      unavailable: true,
    });
  });

  it("JWKS outage: cached keys verify for 24 h, then unavailable", async () => {
    const k1 = await keyPair("k1");
    let down = false;
    const fetchFn = (async () => {
      if (down) throw new TypeError("fetch failed");
      return new Response(JSON.stringify({ keys: [k1.jwk] }), { status: 200 });
    }) as typeof fetch;
    let t = Date.now();
    const v = createIdentityVerifier({ issuer: ISS, fetch: fetchFn, now: () => t });
    const verify = async () => v.verify(bearer(await sign(k1.privateKey, goodClaims())));
    expect((await verify()).ok).toBe(true);
    down = true;
    t += 23 * 3_600_000;
    expect((await verify()).ok).toBe(true);
    t += 3_600_000 + 1000;
    expect(await verify()).toEqual({ ok: false, code: "jwks_unavailable", unavailable: true });
  });
});
