import { describe, expect, it } from "vitest";
import { normalizeInviteEmail, validateInvitationRecord } from "./invitation";

const NOW = Date.parse("2026-11-22T00:00:00Z");
const ID = "33333333-3333-4333-8333-333333333333";
const good = {
  email: "A@X.vn",
  role: "simap:user",
  identityInvitationId: ID,
  expiresAt: "2026-11-29T00:00:00Z",
};
const bad = (o: Record<string, unknown>) => validateInvitationRecord({ ...good, ...o }, NOW);

describe("normalizeInviteEmail", () => {
  it("trims and lowercases", () => expect(normalizeInviteEmail("  A@X.vn ")).toBe("a@x.vn"));
  it("rejects bad shapes", () => {
    for (const v of ["", "a@b", "a@@b.co", "a@b@c.co", `${"a".repeat(250)}@b.co`, 5, null]) {
      expect(normalizeInviteEmail(v)).toBeNull();
    }
  });
  it("keeps a Vietnamese local part", () => {
    expect(normalizeInviteEmail("Nguyễn@x.vn")).toBe("nguyễn@x.vn");
  });
});

describe("validateInvitationRecord", () => {
  it("happy path", () => {
    expect(validateInvitationRecord(good, NOW)).toEqual({
      ok: true,
      value: { ...good, email: "a@x.vn", expiresAt: "2026-11-29T00:00:00.000Z" },
    });
  });
  it("converts an offset to UTC", () => {
    const r = bad({ expiresAt: "2026-11-29T07:00:00+07:00" });
    expect(r).toMatchObject({ ok: true, value: { expiresAt: "2026-11-29T00:00:00.000Z" } });
  });
  it("rejects an extra key, a missing key and a non-object", () => {
    expect(bad({ token: "x" })).toEqual({ ok: false, field: "token" });
    const { email: _e, ...rest } = good;
    expect(validateInvitationRecord(rest, NOW)).toEqual({ ok: false, field: "email" });
    for (const b of [null, [], "x", 3]) {
      expect(validateInvitationRecord(b, NOW)).toEqual({ ok: false, field: "body" });
    }
  });
  it("rejects roles outside user and manager", () => {
    for (const role of ["simap:admin", "simap:member", "manager", 1]) {
      expect(bad({ role })).toEqual({ ok: false, field: "role" });
    }
    expect(bad({ role: "simap:manager" }).ok).toBe(true);
  });
  it("rejects a non-canonical invitation id", () => {
    for (const v of [
      "AAAAAAAA-1111-4111-8111-111111111111",
      "x",
      1,
      "00000000-0000-0000-0000-000000000000",
    ]) {
      expect(bad({ identityInvitationId: v })).toEqual({
        ok: false,
        field: "identityInvitationId",
      });
    }
  });
  it("rejects bad or out-of-window expiresAt", () => {
    for (const v of [
      5,
      "2026-11-29T00:00:00",
      "nope",
      "2026-13-40T00:00:00Z",
      "2026-11-21T23:58:00Z",
      "2026-12-23T00:00:01Z",
    ]) {
      expect(bad({ expiresAt: v })).toEqual({ ok: false, field: "expiresAt" });
    }
  });
});
