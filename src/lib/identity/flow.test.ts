import { describe, expect, it } from "vitest";
import { initialView, viewForMe, viewForTokenError } from "./flow";
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

  it("403 org_required -> noOrg", () => {
    expect(viewForMe({ status: 403, code: "org_required" })).toEqual({ kind: "noOrg" });
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
