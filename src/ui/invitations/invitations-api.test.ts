import { describe, expect, it, vi } from "vitest";
import { ApiAccessError } from "@/lib/api/fetch";
import { createInvitationsApi } from "./invitations-api";

const v = {
  email: "a@x.vn",
  role: "simap:user" as const,
  identityInvitationId: "33333333-3333-4333-8333-333333333333",
  expiresAt: "2026-11-29T00:00:00.000Z",
};
const DTO = { id: "i", email: "a@x.vn", role: "simap:user", createdAt: "c", expiresAt: "e" };

describe("createInvitationsApi.record", () => {
  it("POSTs the JSON body; 201 -> ok with the DTO", async () => {
    const f = vi.fn(async (..._a: unknown[]) => Response.json(DTO, { status: 201 }));
    const out = await createInvitationsApi(f as never).record(v);
    expect(out).toEqual({ ok: true, value: DTO });
    const [path, init] = f.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/invitations");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual(v);
  });
  it("422 -> role_not_allowed", async () => {
    const f = async () => Response.json({ error: { code: "role_not_allowed" } }, { status: 422 });
    expect(await createInvitationsApi(f as never).record(v)).toEqual({
      ok: false,
      code: "role_not_allowed",
    });
  });
  it("ApiAccessError -> its code; fetch throw -> unavailable; never throws", async () => {
    const access = async () => {
      throw new ApiAccessError("forbidden" as never);
    };
    expect(await createInvitationsApi(access as never).record(v)).toEqual({
      ok: false,
      code: "forbidden",
    });
    const boom = async () => {
      throw new Error("x");
    };
    expect(await createInvitationsApi(boom as never).record(v)).toEqual({
      ok: false,
      code: "unavailable",
    });
    const junk = async () => new Response("<html>", { status: 502 });
    expect(await createInvitationsApi(junk as never).record(v)).toEqual({
      ok: false,
      code: "internal",
    });
  });
});
