import { describe, expect, it } from "vitest";
import {
  forgotOutcome,
  resendOutcome,
  resetOutcome,
  signUpOutcome,
  verifyOutcome,
} from "./email-flows";
import type { AuthError, AuthErrorCode } from "./types";

const fail = (code: AuthErrorCode, extra: Partial<AuthError> = {}) =>
  ({ ok: false, error: { code, ...extra } }) as const;
const ok = { ok: true } as const;

describe("signUpOutcome", () => {
  it("ok is sent", () => expect(signUpOutcome(ok)).toEqual({ kind: "sent" }));

  it("maps errors and always spends Turnstile", () => {
    expect(signUpOutcome(fail("email_taken"))).toMatchObject({ kind: "error", field: "email" });
    const weak = signUpOutcome(fail("weak_password", { reasons: ["too_short", "too_common"] }));
    expect(weak).toMatchObject({
      field: "password",
      error: { reasons: ["too_short", "too_common"] },
    });
    for (const code of [
      "validation_error",
      "turnstile_failed",
      "turnstile_required",
      "rate_limited",
      "network",
      "unknown",
    ] as const) {
      const out = signUpOutcome(
        fail(code, code === "rate_limited" ? { retryAfterSeconds: 9 } : {}),
      );
      expect(out).toMatchObject({ kind: "error", error: { code }, resetTurnstile: true });
    }
    expect(signUpOutcome(fail("rate_limited", { retryAfterSeconds: 9 }))).toMatchObject({
      error: { retryAfterSeconds: 9 },
    });
  });
});

describe("forgotOutcome", () => {
  it("ok is sent", () => expect(forgotOutcome(ok)).toEqual({ kind: "sent" }));

  it("keeps listed codes and resets Turnstile", () => {
    for (const code of ["turnstile_failed", "turnstile_required", "rate_limited"] as const) {
      expect(forgotOutcome(fail(code))).toMatchObject({
        error: { code },
        resetTurnstile: true,
      });
    }
    expect(forgotOutcome(fail("validation_error"))).toMatchObject({ field: "email" });
  });

  it("maps every other code to the generic error", () => {
    for (const code of [
      "network",
      "unknown",
      "email_unverified",
      "not_member",
      "email_taken",
    ] as const) {
      expect(forgotOutcome(fail(code))).toMatchObject({
        error: { code: "unknown" },
        resetTurnstile: true,
      });
    }
  });
});

describe("verifyOutcome", () => {
  it("ok is verified and clears the token", () => {
    expect(verifyOutcome(ok)).toEqual({ kind: "verified", clearToken: true });
  });
  it("token_invalid / validation_error are invalid", () => {
    for (const code of ["token_invalid", "validation_error"] as const) {
      expect(verifyOutcome(fail(code))).toEqual({ kind: "invalid", clearToken: true });
    }
  });
  it("rate_limited, network, unknown keep the token for a retry", () => {
    for (const code of ["rate_limited", "network", "unknown"] as const) {
      expect(verifyOutcome(fail(code))).toMatchObject({
        kind: "ready",
        error: { code },
        clearToken: false,
      });
    }
  });
});

describe("resetOutcome", () => {
  it("ok is done and clears the token", () => {
    expect(resetOutcome(ok)).toEqual({ kind: "done", clearToken: true });
  });
  it("weak_password keeps the form, the reasons and the token", () => {
    expect(resetOutcome(fail("weak_password", { reasons: ["too_common"] }))).toEqual({
      kind: "ready",
      error: { code: "weak_password", reasons: ["too_common"] },
      clearToken: false,
    });
  });
  it("token_invalid / validation_error are invalid", () => {
    for (const code of ["token_invalid", "validation_error"] as const) {
      expect(resetOutcome(fail(code))).toEqual({ kind: "invalid", clearToken: true });
    }
  });
  it("rate_limited, network, unknown keep the token", () => {
    for (const code of ["rate_limited", "network", "unknown"] as const) {
      expect(resetOutcome(fail(code))).toMatchObject({ kind: "ready", clearToken: false });
    }
  });
});

describe("resendOutcome", () => {
  it("maps results", () => {
    expect(resendOutcome(ok)).toEqual({ kind: "sent" });
    expect(resendOutcome(fail("email_already_verified"))).toEqual({ kind: "recheck" });
    expect(resendOutcome(fail("session_invalid"))).toMatchObject({ kind: "signIn" });
    expect(resendOutcome(fail("rate_limited", { retryAfterSeconds: 5 }))).toMatchObject({
      kind: "error",
      error: { retryAfterSeconds: 5 },
    });
    for (const code of ["network", "unknown"] as const) {
      expect(resendOutcome(fail(code))).toMatchObject({ kind: "error", error: { code } });
    }
  });
});
