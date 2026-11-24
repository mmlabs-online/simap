import { describe, expect, it } from "vitest";
import { DRIVE_MAX_BYTES, DriveError, createDriveClient, type DriveCode } from "./client";

const CLIENT_SECRET = "SECRET-SENTINEL-client-secret";
const REFRESH = "SECRET-SENTINEL-refresh-token";
const ACCESS = "SECRET-SENTINEL-access-token";
const GOOGLE_MSG = "SENSITIVE google message";
const config = {
  clientId: "123-abc.apps.googleusercontent.com",
  clientSecret: CLIENT_SECRET,
  refreshToken: REFRESH,
  folderId: "ROOTFOLDER1234",
};
const FILE = "FILEID1234567";
const ORG = "11111111-1111-4111-8111-111111111111";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

type Call = { url: string; init: RequestInit };
type Reply = Response | Error | ((c: Call) => Response | Promise<Response>);

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });
const tokenOk = (expires_in = 3600) => json({ access_token: ACCESS, expires_in });
const gerr = (status: number, reason: string) =>
  json({ error: { errors: [{ reason, message: GOOGLE_MSG }], message: GOOGLE_MSG } }, status);

/** Fake fetch: replies are consumed in order; token requests get a token unless `routes` handles them. */
function setup(replies: Reply[]) {
  const calls: Call[] = [];
  const logs: Record<string, unknown>[] = [];
  const sleeps: number[] = [];
  let clock = 1_000_000;
  const queue = [...replies];
  const fakeFetch = (async (url: string, init: RequestInit) => {
    const call = { url: String(url), init };
    calls.push(call);
    if (call.url === TOKEN_URL && queue.length === 0) return tokenOk();
    const r = queue.shift();
    if (!r) throw new Error("no reply queued");
    if (r instanceof Error) throw r;
    return typeof r === "function" ? r(call) : r;
  }) as unknown as typeof fetch;
  const client = createDriveClient({
    config,
    fetch: fakeFetch,
    now: () => clock,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    random: () => 0,
    log: (e) => logs.push(e),
  });
  const api = calls;
  return {
    client,
    calls: api,
    logs,
    sleeps,
    advance: (ms: number) => {
      clock += ms;
    },
    apiCalls: () => calls.filter((c) => c.url !== TOKEN_URL),
    tokenCalls: () => calls.filter((c) => c.url === TOKEN_URL),
  };
}

async function codeOf(p: Promise<unknown>): Promise<DriveCode> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(DriveError);
    return (e as DriveError).code;
  }
  throw new Error("expected rejection");
}

const bytes = (n: number) => new Uint8Array(n).fill(7);

describe("token refresh", () => {
  it("POSTs a form body to the token URL, caches until expires_in - 60 s, then refreshes", async () => {
    const s = setup([tokenOk(3600), json({}), json({}), tokenOk(3600), json({})]);
    await s.client.deleteFile(FILE);
    expect(s.tokenCalls()).toHaveLength(1);
    const t = s.tokenCalls()[0];
    expect(t.init.method).toBe("POST");
    const form = new URLSearchParams(String(t.init.body));
    expect(Object.fromEntries(form)).toEqual({
      client_id: config.clientId,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH,
      grant_type: "refresh_token",
    });
    expect((s.apiCalls()[0].init.headers as Record<string, string>).authorization).toBe(
      `Bearer ${ACCESS}`,
    );
    s.advance(3_539_000);
    await s.client.deleteFile(FILE);
    expect(s.tokenCalls()).toHaveLength(1);
    s.advance(2_000);
    await s.client.deleteFile(FILE);
    expect(s.tokenCalls()).toHaveLength(2);
  });

  it("concurrent calls share one refresh (single-flight)", async () => {
    const s = setup([tokenOk(), json({}), json({}), json({})]);
    await Promise.all([
      s.client.deleteFile(FILE),
      s.client.deleteFile(FILE),
      s.client.deleteFile(FILE),
    ]);
    expect(s.tokenCalls()).toHaveLength(1);
  });

  it("invalid_grant → drive_auth, 60 s cooldown without fetch; inflight cleared so waiters reject", async () => {
    const grant = () => json({ error: "invalid_grant", error_description: GOOGLE_MSG }, 400);
    const bad = setup([grant(), grant()]);
    const waiters = [codeOf(bad.client.deleteFile(FILE)), codeOf(bad.client.deleteFile(FILE))];
    expect(await Promise.all(waiters)).toEqual(["drive_auth", "drive_auth"]);
    expect(bad.tokenCalls()).toHaveLength(1);
    const before = bad.calls.length;
    expect(await codeOf(bad.client.deleteFile(FILE))).toBe("drive_auth");
    expect(bad.calls.length).toBe(before);
    expect(bad.logs[0]).toMatchObject({ op: "token", reason: "invalid_grant", status: 400 });
    // after the cooldown a new refresh is attempted (inflight was cleared)
    bad.advance(61_000);
    expect(await codeOf(bad.client.deleteFile(FILE))).toBe("drive_auth");
    expect(bad.calls.length).toBe(before + 1);
  });

  it("token 5xx retried up to 3 then drive_unavailable; 429 → drive_rate_limited; redirect and bad body → drive_bad_response", async () => {
    const a = setup([json({}, 500), json({}, 502), json({}, 503)]);
    expect(await codeOf(a.client.deleteFile(FILE))).toBe("drive_unavailable");
    expect(a.tokenCalls()).toHaveLength(3);
    expect(a.sleeps).toEqual([500, 1000]);

    const b = setup([json({}, 429, { "retry-after": "2" }), json({}, 429), json({}, 429)]);
    expect(await codeOf(b.client.deleteFile(FILE))).toBe("drive_rate_limited");
    expect(b.sleeps[0]).toBe(2000);

    const c = setup([new Response(null, { status: 302, headers: { location: "https://x.test" } })]);
    expect(await codeOf(c.client.deleteFile(FILE))).toBe("drive_bad_response");

    const d = setup([json({ expires_in: 3600 })]);
    expect(await codeOf(d.client.deleteFile(FILE))).toBe("drive_bad_response");
    const e = setup([new Response("not json", { status: 200 })]);
    expect(await codeOf(e.client.deleteFile(FILE))).toBe("drive_bad_response");
  });
});

describe("createFile", () => {
  it("sends a multipart body (metadata with parents + appProperties, then bytes) to the upload endpoint", async () => {
    const s = setup([tokenOk(), json({ id: "NEWFILE123456", size: "3", mimeType: "image/png" })]);
    const out = await s.client.createFile({
      name: "a.png",
      mimeType: "image/png",
      bytes: new Uint8Array([1, 2, 3]),
      parentId: "PARENTFOLDER1",
      appProperties: { app: "simap", orgId: ORG },
    });
    expect(out).toEqual({ id: "NEWFILE123456", size: 3, mimeType: "image/png" });
    const c = s.apiCalls()[0];
    expect(c.url).toBe(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,size,mimeType",
    );
    expect(c.init.method).toBe("POST");
    const ct = (c.init.headers as Record<string, string>)["content-type"];
    const boundary = /^multipart\/related; boundary=(simap[0-9a-f]{24})$/.exec(ct)?.[1];
    expect(boundary).toBeTruthy();
    const raw = Buffer.from(c.init.body as Uint8Array).toString("latin1");
    const parts = raw.split(`--${boundary}`);
    expect(parts[1]).toContain("Content-Type: application/json; charset=UTF-8");
    const meta = JSON.parse(parts[1].split("\r\n\r\n")[1]);
    expect(meta).toEqual({
      name: "a.png",
      mimeType: "image/png",
      parents: ["PARENTFOLDER1"],
      appProperties: { app: "simap", orgId: ORG },
    });
    expect(parts[2]).toBe("\r\nContent-Type: image/png\r\n\r\n\x01\x02\x03\r\n");
    expect(parts[3]).toBe("--");
  });

  it("is never retried on 5xx or network error; 401 refreshes and retries once", async () => {
    const a = setup([tokenOk(), json({}, 500)]);
    expect(
      await codeOf(a.client.createFile({ name: "a", mimeType: "image/png", bytes: bytes(3) })),
    ).toBe("drive_unavailable");
    expect(a.apiCalls()).toHaveLength(1);

    const b = setup([tokenOk(), new Error("boom")]);
    expect(
      await codeOf(b.client.createFile({ name: "a", mimeType: "image/png", bytes: bytes(3) })),
    ).toBe("drive_unavailable");
    expect(b.apiCalls()).toHaveLength(1);

    const c = setup([
      tokenOk(),
      gerr(401, "authError"),
      tokenOk(),
      json({ id: "NEWFILE123456", size: "3", mimeType: "image/png" }),
    ]);
    await c.client.createFile({ name: "a", mimeType: "image/png", bytes: bytes(3) });
    expect(c.tokenCalls()).toHaveLength(2);
    expect(c.apiCalls()).toHaveLength(2);
  });

  it("rejects too large, bad mime and a response id that is not a valid id", async () => {
    const a = setup([]);
    expect(
      await codeOf(
        a.client.createFile({
          name: "a",
          mimeType: "image/png",
          bytes: bytes(DRIVE_MAX_BYTES + 1),
        }),
      ),
    ).toBe("drive_too_large");
    expect(
      await codeOf(a.client.createFile({ name: "a", mimeType: "image/png\r\nx", bytes: bytes(1) })),
    ).toBe("drive_bad_response");
    expect(
      await codeOf(
        a.client.createFile({ name: "a", mimeType: "image/png", bytes: bytes(1), parentId: "a/b" }),
      ),
    ).toBe("drive_invalid_id");
    expect(a.calls).toHaveLength(0);

    const b = setup([tokenOk(), json({ id: "../x", size: "1" })]);
    expect(
      await codeOf(b.client.createFile({ name: "a", mimeType: "image/png", bytes: bytes(1) })),
    ).toBe("drive_bad_response");
  });
});

describe("getFile", () => {
  it("GETs files/<id>?alt=media and returns bytes and content type", async () => {
    const s = setup([
      tokenOk(),
      new Response(new Uint8Array([9, 8, 7]), { headers: { "content-type": "image/png" } }),
    ]);
    const out = await s.client.getFile(FILE);
    expect(Array.from(out.bytes)).toEqual([9, 8, 7]);
    expect(out.contentType).toBe("image/png");
    const c = s.apiCalls()[0];
    expect(c.url).toBe(`https://www.googleapis.com/drive/v3/files/${FILE}?alt=media`);
    expect(c.init.method).toBe("GET");
  });

  it("body above the cap → drive_too_large (stream cancelled); content-length above the cap too", async () => {
    let cancelled = false;
    const big = new ReadableStream<Uint8Array>({
      pull(c) {
        c.enqueue(bytes(40 * 1024));
      },
      cancel() {
        cancelled = true;
      },
    });
    const a = setup([tokenOk(), new Response(big)]);
    expect(await codeOf(a.client.getFile(FILE))).toBe("drive_too_large");
    expect(cancelled).toBe(true);

    const b = setup([
      tokenOk(),
      new Response(bytes(10), { headers: { "content-length": String(DRIVE_MAX_BYTES + 1) } }),
    ]);
    expect(await codeOf(b.client.getFile(FILE))).toBe("drive_too_large");
  });
});

describe("deleteFile", () => {
  it("DELETEs files/<id>; 404 resolves; 500 is retried then drive_unavailable", async () => {
    const a = setup([tokenOk(), new Response(null, { status: 204 })]);
    await a.client.deleteFile(FILE);
    expect(a.apiCalls()[0].url).toBe(`https://www.googleapis.com/drive/v3/files/${FILE}`);
    expect(a.apiCalls()[0].init.method).toBe("DELETE");

    const b = setup([tokenOk(), gerr(404, "notFound")]);
    await expect(b.client.deleteFile(FILE)).resolves.toBeUndefined();

    const c = setup([tokenOk(), json({}, 500), json({}, 500), json({}, 500)]);
    expect(await codeOf(c.client.deleteFile(FILE))).toBe("drive_unavailable");
    expect(c.apiCalls()).toHaveLength(3);
  });
});

describe("status mapping", () => {
  const run = (replies: Reply[]) => {
    const s = setup([tokenOk(), ...replies]);
    return codeOf(s.client.getFile(FILE));
  };

  it("maps Google failures to fixed codes", async () => {
    expect(await run([gerr(401, "authError"), tokenOk(), gerr(401, "authError")])).toBe(
      "drive_auth",
    );
    expect(await run([gerr(403, "insufficientFilePermissions")])).toBe("drive_forbidden");
    expect(
      await run([
        gerr(403, "rateLimitExceeded"),
        gerr(403, "rateLimitExceeded"),
        gerr(403, "rateLimitExceeded"),
      ]),
    ).toBe("drive_rate_limited");
    expect(await run([gerr(404, "notFound")])).toBe("drive_not_found");
    expect(await run([gerr(429, "x"), gerr(429, "x"), gerr(429, "x")])).toBe("drive_rate_limited");
    expect(await run([json({}, 500), json({}, 500), json({}, 500)])).toBe("drive_unavailable");
    expect(await run([gerr(400, "x")])).toBe("drive_bad_response");
    expect(await run([new Error("net"), new Error("net"), new Error("net")])).toBe(
      "drive_unavailable",
    );
  });
});

describe("ids and fetch options", () => {
  it("an invalid file id throws drive_invalid_id without calling fetch", async () => {
    const s = setup([]);
    for (const id of [undefined, "", "../x", "a b", "a".repeat(9), "a".repeat(201)]) {
      expect(await codeOf(s.client.getFile(id as unknown as string))).toBe("drive_invalid_id");
      expect(await codeOf(s.client.deleteFile(id as unknown as string))).toBe("drive_invalid_id");
    }
    expect(s.calls).toHaveLength(0);
  });

  it("every fetch has cache no-store and redirect manual (media: follow)", async () => {
    const s = setup([tokenOk(), new Response(bytes(2)), new Response(null, { status: 204 })]);
    await s.client.getFile(FILE);
    await s.client.deleteFile(FILE);
    expect(s.calls.map((c) => [c.init.cache, c.init.redirect])).toEqual([
      ["no-store", "manual"],
      ["no-store", "follow"],
      ["no-store", "manual"],
    ]);
  });
});

describe("findOrgFolders", () => {
  it("builds q only from validated ids and pages through results", async () => {
    const s = setup([
      tokenOk(),
      json({
        files: [{ id: "FOLDERAAAAAA1", createdTime: "2026-01-02T00:00:00.000Z" }],
        nextPageToken: "NEXT",
      }),
      json({ files: [{ id: "FOLDERBBBBBB2" }] }),
    ]);
    const out = await s.client.findOrgFolders(ORG);
    expect(out).toEqual([
      { id: "FOLDERAAAAAA1", createdTime: Date.parse("2026-01-02T00:00:00.000Z") },
      { id: "FOLDERBBBBBB2", createdTime: null },
    ]);
    const u = new URL(s.apiCalls()[0].url);
    expect(u.searchParams.get("q")).toContain(
      `appProperties has { key='orgId' and value='${ORG}' }`,
    );
    expect(u.searchParams.get("q")).toContain(`'${config.folderId}' in parents`);
    expect(u.searchParams.get("pageSize")).toBe("100");
    expect(new URL(s.apiCalls()[1].url).searchParams.get("pageToken")).toBe("NEXT");
  });

  it("a non-uuid org throws drive_invalid_id without fetch; more than 10 pages → drive_bad_response", async () => {
    const s = setup([]);
    for (const o of [
      "x",
      "' or 1=1",
      "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
      "00000000-0000-0000-0000-000000000000",
    ]) {
      expect(await codeOf(s.client.findOrgFolders(o))).toBe("drive_invalid_id");
    }
    expect(s.calls).toHaveLength(0);

    const pages = Array.from({ length: 11 }, () => json({ files: [], nextPageToken: "N" }));
    const p = setup([tokenOk(), ...pages]);
    expect(await codeOf(p.client.findOrgFolders(ORG))).toBe("drive_bad_response");
    expect(p.apiCalls()).toHaveLength(10);
  });
});

describe("failure shape", () => {
  it("every failure path: error and log shape carry no secret, token or Google text", async () => {
    const scenarios: Reply[][] = [
      [tokenOk(), gerr(401, "authError"), tokenOk(), gerr(401, "authError")],
      [tokenOk(), gerr(403, "insufficientFilePermissions")],
      [
        tokenOk(),
        gerr(403, "rateLimitExceeded"),
        gerr(403, "rateLimitExceeded"),
        gerr(429, "weird"),
      ],
      [tokenOk(), gerr(404, "notFound")],
      [tokenOk(), gerr(500, "backendError"), gerr(500, "backendError"), gerr(500, "backendError")],
      [tokenOk(), gerr(400, "madeUp")],
      [tokenOk(), new Error(`${GOOGLE_MSG} ${ACCESS}`), new Error("x"), new Error("x")],
      [json({ error: "invalid_grant", error_description: GOOGLE_MSG }, 400)],
      [tokenOk(), json({ error: { message: GOOGLE_MSG } }, 400)],
    ];
    const reasons = new Set([
      "invalid_grant",
      "invalid_client",
      "unauthorized_client",
      "rateLimitExceeded",
      "userRateLimitExceeded",
      "storageQuotaExceeded",
      "insufficientFilePermissions",
      "notFound",
      "cannotAddParent",
      "authError",
      "backendError",
      "other",
    ]);
    for (const replies of scenarios) {
      const s = setup(replies);
      let err: unknown;
      try {
        await s.client.getFile(FILE);
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(DriveError);
      const e = err as DriveError;
      expect(Object.getOwnPropertyNames(e).filter((k) => k !== "stack")).toEqual(
        expect.arrayContaining(["message", "code"]),
      );
      for (const k of Object.getOwnPropertyNames(e)) {
        expect(["stack", "message", "name", "code", "status"]).toContain(k);
      }
      expect(e.message).toBe(e.code);
      expect("cause" in e).toBe(false);
      const text = [String(e), e.message, ...s.logs.map((l) => JSON.stringify(l))].join("|");
      for (const secret of [
        CLIENT_SECRET,
        REFRESH,
        ACCESS,
        GOOGLE_MSG,
        "https://",
        "authorization",
      ]) {
        expect(text).not.toContain(secret);
      }
      expect(s.logs.length).toBeGreaterThan(0);
      for (const l of s.logs) {
        expect(
          Object.keys(l).every((k) => ["event", "op", "status", "code", "reason"].includes(k)),
        ).toBe(true);
        expect(l.event).toBe("drive");
        if (l.reason !== undefined) expect(reasons.has(l.reason as string)).toBe(true);
      }
    }
  });
});
