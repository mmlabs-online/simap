import { describe, expect, it } from "vitest";
import { acceptOutcome, signInOutcome } from "./accept-flow";

const fail = (code: string, extra = {}) =>
  ({ ok: false, error: { code, ...extra } }) as Parameters<typeof acceptOutcome>[0];

describe("acceptOutcome", () => {
  it("ok maps to done and clears the token", () => {
    expect(acceptOutcome({ ok: true, orgId: "o1" })).toEqual({
      kind: "done",
      orgId: "o1",
      clearToken: true,
    });
    expect(acceptOutcome({ ok: true, orgId: null })).toEqual({
      kind: "done",
      orgId: null,
      clearToken: true,
    });
  });

  it.each(["token_invalid", "validation_error"])("%s is invalid and clears the token", (code) => {
    expect(acceptOutcome(fail(code))).toEqual({ kind: "invalid", clearToken: true });
  });

  it("mismatch keeps the token and offers another account", () => {
    expect(acceptOutcome(fail("invitation_email_mismatch"))).toEqual({
      kind: "ready",
      error: { code: "invitation_email_mismatch" },
      clearToken: false,
      offerOtherAccount: true,
    });
  });

  it("session_invalid goes to sign-in and keeps the token", () => {
    expect(acceptOutcome(fail("session_invalid"))).toEqual({
      kind: "signIn",
      error: { code: "session_invalid" },
      clearToken: false,
    });
  });

  it.each([
    fail("email_unverified"),
    fail("org_invite_unavailable"),
    fail("rate_limited", { retryAfterSeconds: 30 }),
    fail("network"),
    fail("unknown"),
    fail("not_member"),
  ])("other errors stay ready, pass through, keep the token", (r) => {
    expect(acceptOutcome(r)).toEqual({
      kind: "ready",
      error: (r as { error: unknown }).error,
      clearToken: false,
    });
  });
});

describe("signInOutcome", () => {
  it.each([{ ok: true }, fail("not_member"), fail("email_unverified")])("%j continues", (r) => {
    expect(signInOutcome(r as Parameters<typeof signInOutcome>[0])).toEqual({ kind: "continue" });
  });

  it("turnstile_required needs Turnstile", () => {
    expect(signInOutcome(fail("turnstile_required"))).toEqual({
      kind: "signIn",
      error: { code: "turnstile_required" },
      needTurnstile: true,
    });
  });

  it.each([
    "invalid_credentials",
    "turnstile_failed",
    "rate_limited",
    "session_invalid",
    "network",
    "unknown",
  ])("%s stays on sign-in", (code) => {
    expect(signInOutcome(fail(code))).toEqual({ kind: "signIn", error: { code } });
  });
});
