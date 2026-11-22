import { describe, expect, it } from "vitest";
import type { AuthErrorCode } from "@/lib/identity/types";
import { inviteOutcome, recordOutcome } from "./invite-flow";

const fail = (code: AuthErrorCode, retryAfterSeconds?: number) =>
  inviteOutcome({ ok: false, error: { code, ...(retryAfterSeconds && { retryAfterSeconds }) } });

describe("inviteOutcome", () => {
  it("ok -> sent", () => expect(inviteOutcome({ ok: true })).toEqual({ kind: "sent" }));
  it("validation_error -> email field", () => {
    expect(fail("validation_error")).toMatchObject({ kind: "error", field: "email" });
  });
  it.each(["unknown_role", "invite_role_forbidden"] as const)("%s -> role field", (code) => {
    expect(fail(code)).toMatchObject({ kind: "error", field: "role" });
  });
  it.each([
    "org_access_denied",
    "org_invite_forbidden",
    "invitation_limit_reached",
    "org_invite_unavailable",
    "email_unverified",
    "session_invalid",
    "network",
    "unknown",
  ] as const)("%s -> error with no field", (code) => {
    const out = fail(code);
    expect(out).toMatchObject({ kind: "error", error: { code } });
    expect(out).not.toHaveProperty("field");
  });
  it("rate_limited keeps retryAfterSeconds", () => {
    expect(fail("rate_limited", 30)).toMatchObject({ error: { retryAfterSeconds: 30 } });
  });
});

describe("recordOutcome", () => {
  it("ok -> sent", () => {
    expect(recordOutcome({ ok: true })).toEqual({ kind: "sent" });
  });
  it("any failure -> sentNotRecorded, never error", () => {
    for (const code of ["unavailable", "unauthenticated", "internal", "role_not_allowed"]) {
      expect(recordOutcome({ ok: false, code })).toEqual({ kind: "sentNotRecorded", code });
    }
  });
});
