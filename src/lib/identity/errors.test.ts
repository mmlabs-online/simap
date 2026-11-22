import { describe, expect, it } from "vitest";
import { networkError, toAuthError } from "./errors";

const body = (code: unknown, details?: unknown) => ({ error: { code, message: "x", details } });
const h = (retry?: string) => new Headers(retry === undefined ? {} : { "Retry-After": retry });

describe("toAuthError", () => {
  it("accepts a code only from the server list", () => {
    expect(toAuthError(403, h(), body("not_member")).code).toBe("not_member");
    for (const code of [
      "__proto__",
      "constructor",
      "no_access",
      "weak_too_short",
      "app_header_required",
      "origin_not_allowed",
      "audience_mismatch",
      42,
      null,
    ]) {
      expect(toAuthError(403, h(), body(code)).code).toBe("unknown");
    }
  });

  it("non-JSON, empty and 500 bodies are unknown", () => {
    expect(toAuthError(500, h(), null).code).toBe("unknown");
    expect(toAuthError(500, h(), "oops").code).toBe("unknown");
    expect(toAuthError(500, null, { error: null }).code).toBe("unknown");
    expect(toAuthError(500, h(), undefined).code).toBe("unknown");
  });

  it("weak_password reasons: only an array, filtered", () => {
    const reasons = (r: unknown) => toAuthError(422, h(), body("weak_password", { reasons: r }));
    expect(reasons(["too_short", "bogus", "too_common"]).reasons).toEqual([
      "too_short",
      "too_common",
    ]);
    expect(reasons("too_short").reasons).toBeUndefined();
    expect(reasons({ 0: "too_short" }).reasons).toBeUndefined();
    expect(reasons(["bogus"]).reasons).toBeUndefined();
  });

  it("Retry-After is parsed and clamped", () => {
    const wait = (v?: string) => toAuthError(429, h(v), body("rate_limited")).retryAfterSeconds;
    expect(wait("120")).toBe(120);
    expect(wait("abc")).toBeUndefined();
    expect(wait()).toBeUndefined();
    expect(wait("99999999")).toBe(86400);
    expect(wait("0")).toBeUndefined();
    expect(wait("-5")).toBeUndefined();
  });

  it("falls back to details.retry_after", () => {
    const e = toAuthError(429, h(), body("rate_limited", { retry_after: 30 }));
    expect(e.retryAfterSeconds).toBe(30);
  });

  it("never throws on hostile input", () => {
    const hostile = {
      get error(): never {
        throw new Error("boom");
      },
    };
    expect(toAuthError(500, h(), hostile).code).toBe("unknown");
  });

  it("networkError", () => {
    expect(networkError()).toEqual({ code: "network" });
  });
});

describe("join", () => {
  it("not_member joinAvailable only for details.join_available === true ('true', 1, missing, null -> absent)", () => {
    expect(toAuthError(403, h(), body("not_member", { join_available: true }))).toEqual({
      code: "not_member",
      joinAvailable: true,
    });
    for (const details of [
      { join_available: "true" },
      { join_available: 1 },
      {},
      null,
      undefined,
    ]) {
      expect(toAuthError(403, h(), body("not_member", details))).toEqual({ code: "not_member" });
    }
    expect(toAuthError(403, h(), body("not_member", { join_available: false }))).toEqual({
      code: "not_member",
    });
  });

  it("join codes are accepted; app_mismatch -> unknown", () => {
    for (const code of ["join_closed", "join_rejected", "join_queue_full", "join_unavailable"]) {
      expect(toAuthError(403, h(), body(code)).code).toBe(code);
    }
    expect(toAuthError(403, h(), body("app_mismatch")).code).toBe("unknown");
  });

  it("join_approval_unavailable is gone (-> unknown); no_access is never accepted from a body", () => {
    expect(toAuthError(403, h(), body("join_approval_unavailable")).code).toBe("unknown");
    expect(toAuthError(401, h(), body("no_access")).code).toBe("unknown");
  });
});

describe("org errors", () => {
  it("org_access_denied is accepted from the body and orgId is never taken from it", () => {
    expect(
      toAuthError(403, h(), { error: { code: "org_access_denied", details: { org_id: "x" } } }),
    ).toEqual({ code: "org_access_denied" });
  });

  it("org_not_supported maps to unknown", () => {
    expect(toAuthError(422, h(), body("org_not_supported")).code).toBe("unknown");
  });
});

describe("toAuthError: invitation codes", () => {
  it("accepts each invitation code from a server body", () => {
    for (const code of [
      "org_invite_forbidden",
      "invite_role_forbidden",
      "invitation_limit_reached",
      "org_invite_unavailable",
      "invitation_email_mismatch",
      "unknown_role",
    ]) {
      expect(toAuthError(403, h(), body(code)).code).toBe(code);
    }
  });
  it("an unlisted invitation-style code is unknown", () => {
    for (const code of ["join_closed_x", "invitation_invalid", "forbidden"]) {
      expect(toAuthError(403, h(), body(code)).code).toBe("unknown");
    }
  });
});
