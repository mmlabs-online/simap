import { describe, expect, it } from "vitest";
import { API_ERROR_CODES } from "@/lib/api/error";
import type { AuthErrorCode } from "@/lib/identity/types";
import { apiErrorMessage } from "./api";
import { authCopy, authErrorMessage } from "./auth";

const CODES: AuthErrorCode[] = [
  "invalid_credentials",
  "email_unverified",
  "not_member",
  "join_closed",
  "join_rejected",
  "join_queue_full",
  "join_unavailable",
  "session_invalid",
  "turnstile_required",
  "turnstile_failed",
  "rate_limited",
  "network",
  "email_taken",
  "weak_password",
  "validation_error",
  "token_invalid",
  "email_already_verified",
  "org_access_denied",
  "org_invite_forbidden",
  "invite_role_forbidden",
  "invitation_limit_reached",
  "org_invite_unavailable",
  "invitation_email_mismatch",
  "unknown_role",
  "no_access",
  "unknown",
];

describe("authErrorMessage", () => {
  it("returns a non-empty string for every AuthErrorCode", () => {
    expect(Object.keys(authCopy.errors).sort()).toEqual([...CODES].sort());
    for (const code of CODES) expect(authErrorMessage({ code }).trim()).not.toBe("");
  });

  it("invalid_credentials does not reveal whether the account exists", () => {
    const text = authErrorMessage({ code: "invalid_credentials" });
    expect(text).not.toMatch(/exist|found|registered|account/i);
  });

  it("rate_limited contains the wait text; an unknown code reads as unknown", () => {
    expect(authErrorMessage({ code: "rate_limited", retryAfterSeconds: 120 })).toContain(
      "2 minutes",
    );
    expect(authErrorMessage({ code: "nope" as AuthErrorCode })).toBe(authCopy.errors.unknown);
  });

  it("weak_password lists known reasons only", () => {
    expect(authErrorMessage({ code: "weak_password", reasons: ["too_common"] })).toBe(
      authCopy.weak.too_common,
    );
  });
});

describe("apiErrorMessage", () => {
  it("covers every API error code, and forbidden is exactly the permission text", () => {
    for (const code of API_ERROR_CODES) expect(apiErrorMessage(code).trim()).not.toBe("");
    expect(apiErrorMessage("forbidden")).toBe("You don't have permission");
  });
});

describe("invitation error codes", () => {
  it("each has its own message", () => {
    for (const code of [
      "org_invite_forbidden",
      "invite_role_forbidden",
      "invitation_limit_reached",
      "org_invite_unavailable",
      "invitation_email_mismatch",
      "unknown_role",
    ] as AuthErrorCode[]) {
      const text = authErrorMessage({ code });
      expect(text).not.toBe(authErrorMessage({ code: "unknown" }));
      expect(text).not.toMatch(/[{}]|undefined/);
    }
  });
});
