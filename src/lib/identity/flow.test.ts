import { describe, expect, it } from "vitest";
import { ApiAccessError } from "@/lib/api/fetch";
import { initialView, meErrorView, readMeResult, viewForMe, viewForTokenError } from "./flow";
import type { AuthError } from "./types";

const e = (code: AuthError["code"], extra: Partial<AuthError> = {}): AuthError => ({
  code,
  ...extra,
});

describe("viewForTokenError", () => {
  it("not_member + joinAvailable + account -> join", () => {
    expect(viewForTokenError(e("not_member", { joinAvailable: true }), true)).toEqual({
      kind: "join",
    });
  });

  it("not_member without joinAvailable or without an account -> signIn with the error", () => {
    expect(viewForTokenError(e("not_member"), true)).toEqual({
      kind: "signIn",
      error: e("not_member"),
    });
    expect(viewForTokenError(e("not_member", { joinAvailable: true }), false)).toEqual({
      kind: "signIn",
      error: e("not_member", { joinAvailable: true }),
    });
  });

  it("email_unverified + account -> unverified; without an account -> signIn", () => {
    expect(viewForTokenError(e("email_unverified"), true)).toEqual({ kind: "unverified" });
    expect(viewForTokenError(e("email_unverified"), false).kind).toBe("signIn");
  });

  it("session_invalid -> signIn and relist the accounts", () => {
    expect(viewForTokenError(e("session_invalid"), false)).toEqual({
      kind: "signIn",
      error: e("session_invalid"),
      relistAccounts: true,
    });
  });

  it.each(["network", "rate_limited", "unknown"] as const)("%s -> retry", (code) => {
    expect(viewForTokenError(e(code), true)).toEqual({ kind: "retry", error: e(code) });
  });

  it.each(["join_closed", "join_rejected", "join_queue_full", "join_unavailable"] as const)(
    "%s -> join view with the error",
    (code) => {
      expect(viewForTokenError(e(code), true)).toEqual({ kind: "join", error: e(code) });
    },
  );

  it("other codes -> signIn with the error", () => {
    expect(viewForTokenError(e("invalid_credentials"), false)).toEqual({
      kind: "signIn",
      error: e("invalid_credentials"),
    });
  });
});

describe("viewForMe", () => {
  it("200 -> ready with tier and email", () => {
    expect(viewForMe({ status: 200, me: { tier: "manager", email: "a@b.co" } })).toEqual({
      kind: "ready",
      tier: "manager",
      email: "a@b.co",
    });
  });

  it("viewForMe: needsProfile true -> profile view carrying tier, email, displayName", () => {
    const member = { displayName: "ann", needsProfile: true };
    expect(viewForMe({ status: 200, me: { tier: "user", email: "ann@b.co", member } })).toEqual({
      kind: "profile",
      tier: "user",
      email: "ann@b.co",
      displayName: "ann",
    });
  });

  it("viewForMe: needsProfile false or member absent -> ready", () => {
    const base = { tier: "user", email: "a@b.co" } as const;
    const member = { displayName: "a", needsProfile: false };
    for (const me of [{ ...base, member }, base]) {
      expect(viewForMe({ status: 200, me })).toEqual({ kind: "ready", ...base });
    }
  });

  it("403 org_required -> needOrg", () => {
    expect(viewForMe({ status: 403, code: "org_required" })).toEqual({ kind: "needOrg" });
  });

  it("403 forbidden / member_deactivated -> noAccess(code); unknown 403 and a 200 without a body fail closed", () => {
    expect(viewForMe({ status: 403, code: "forbidden" })).toEqual({
      kind: "noAccess",
      code: "forbidden",
    });
    expect(viewForMe({ status: 403, code: "member_deactivated" })).toEqual({
      kind: "noAccess",
      code: "member_deactivated",
    });
    expect(viewForMe({ status: 403 })).toEqual({ kind: "noAccess", code: "forbidden" });
    expect(viewForMe({ status: 200 })).toEqual({ kind: "noAccess", code: "forbidden" });
  });

  it("401 -> signedOut(no_access)", () => {
    expect(viewForMe({ status: 401, code: "unauthenticated" })).toEqual({
      kind: "signedOut",
      error: e("no_access"),
    });
  });

  it("503 and network -> retry", () => {
    expect(viewForMe({ status: 503, code: "unavailable" }).kind).toBe("retry");
    expect(viewForMe({ network: true })).toEqual({ kind: "retry", error: e("network") });
  });
});

describe("initialView", () => {
  it("without an account id -> signIn; with an id -> checking", () => {
    expect(initialView(false)).toEqual({ kind: "signIn" });
    expect(initialView(true)).toEqual({ kind: "checking" });
  });
});

describe("viewForMe 5xx", () => {
  it("500, 502, 503 and 504 -> retry (a server fault is not a permission answer)", () => {
    for (const status of [500, 502, 503, 504]) {
      expect(viewForMe({ status }), String(status)).toEqual({ kind: "retry", error: e("unknown") });
    }
  });

  it("404 and 429 stay fail-closed (noAccess forbidden)", () => {
    for (const status of [404, 429]) {
      expect(viewForMe({ status }), String(status)).toEqual({
        kind: "noAccess",
        code: "forbidden",
      });
    }
  });
});

describe("meErrorView", () => {
  it("ApiAccessError maps like the matching /api/me answer", () => {
    expect(meErrorView(new ApiAccessError("forbidden"), true)).toEqual({
      kind: "noAccess",
      code: "forbidden",
    });
    expect(meErrorView(new ApiAccessError("member_deactivated"), true)).toEqual({
      kind: "noAccess",
      code: "member_deactivated",
    });
    expect(meErrorView(new ApiAccessError("org_required"), true)).toEqual({ kind: "needOrg" });
    expect(meErrorView(new ApiAccessError("unauthenticated"), true)).toEqual({
      kind: "signedOut",
      error: e("no_access"),
    });
    expect(meErrorView(new ApiAccessError("signed_out"), false)).toEqual({ kind: "signIn" });
  });

  it("an AuthError from getToken goes through viewForTokenError", () => {
    expect(meErrorView(e("session_invalid"), true)).toEqual({
      kind: "signIn",
      error: e("session_invalid"),
      relistAccounts: true,
    });
    expect(meErrorView(e("network"), true)).toEqual({ kind: "retry", error: e("network") });
    expect(meErrorView(e("email_unverified"), true)).toEqual({ kind: "unverified" });
  });

  it("a TypeError, a string or null -> retry, never no access", () => {
    for (const err of [new TypeError("fetch failed"), "x", null, undefined]) {
      expect(meErrorView(err, true)).toEqual({ kind: "retry", error: e("network") });
    }
  });
});

describe("readMeResult", () => {
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  it("200 with a valid body -> me", async () => {
    expect(
      await readMeResult(json({ sub: "s", email: "a@b.co", org: "o", tier: "admin" }, 200)),
    ).toEqual({ status: 200, code: undefined, me: { tier: "admin", email: "a@b.co" } });
  });

  it("readMeResult keeps a well-formed member and drops a malformed one", async () => {
    const member = { id: "m", displayName: "a", status: "active", needsProfile: true };
    expect(
      await readMeResult(json({ sub: "s", email: "a@b.co", org: "o", tier: "user", member }, 200)),
    ).toEqual({
      status: 200,
      code: undefined,
      me: { tier: "user", email: "a@b.co", member: { displayName: "a", needsProfile: true } },
    });
    for (const bad of [{ displayName: "a" }, { displayName: 1, needsProfile: true }, "x", null]) {
      const out = await readMeResult(
        json({ sub: "s", email: "a@b.co", org: "o", tier: "user", member: bad }, 200),
      );
      expect(out).toMatchObject({ me: { tier: "user", member: undefined } });
    }
  });

  it("an error body gives its code; a 200 with an unknown tier has no me", async () => {
    expect(await readMeResult(json({ error: { code: "org_required" } }, 403))).toEqual({
      status: 403,
      code: "org_required",
      me: undefined,
    });
    expect(await readMeResult(json({ email: "a@b.co", tier: "root" }, 200))).toMatchObject({
      status: 200,
      me: undefined,
    });
  });

  it("an unreadable body still returns the status", async () => {
    expect(await readMeResult(new Response("<html>", { status: 502 }))).toEqual({
      status: 502,
      code: undefined,
      me: undefined,
    });
  });
});

describe("org_access_denied", () => {
  const ORG = "22222222-2222-4222-8222-222222222222";
  it("with an account and orgId -> pickOrg(error)", () => {
    const err = e("org_access_denied", { orgId: ORG });
    expect(viewForTokenError(err, true)).toEqual({ kind: "pickOrg", error: err });
  });

  it("without an account -> retry(unknown)", () => {
    expect(viewForTokenError(e("org_access_denied", { orgId: ORG }), false)).toEqual({
      kind: "retry",
      error: { code: "unknown" },
    });
  });

  it("without orgId -> retry(unknown), never pickOrg", () => {
    expect(viewForTokenError(e("org_access_denied"), true)).toEqual({
      kind: "retry",
      error: { code: "unknown" },
    });
  });
});
