import { describe, expect, it } from "vitest";
import { ApiAccessError } from "@/lib/api/fetch";
import { mapPatchResult, profilePatchInit, validateProfileName } from "./profile-form";

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const me = (needsProfile: boolean) => ({
  sub: "s",
  email: "a@b.co",
  org: "o",
  tier: "user",
  member: { id: "m", displayName: "a", status: "active", needsProfile },
});

describe("validateProfileName", () => {
  it("rejects blank, whitespace-only, ZWJ/control chars, 81 code points; accepts 80", () => {
    expect(validateProfileName("")).toEqual({ ok: false, error: "required" });
    expect(validateProfileName("   ")).toEqual({ ok: false, error: "required" });
    expect(validateProfileName("a‍b")).toEqual({ ok: false, error: "invalid" });
    expect(validateProfileName("a\u0007b")).toEqual({ ok: false, error: "invalid" });
    expect(validateProfileName("a".repeat(81))).toEqual({ ok: false, error: "invalid" });
    expect(validateProfileName("a".repeat(80))).toEqual({ ok: true, value: "a".repeat(80) });
  });

  it("Vietnamese name: NFD `Nguyễn Văn An` returns NFC; trims and collapses spaces", () => {
    const nfd = "  Nguyễn   Văn An ";
    const out = validateProfileName(nfd);
    expect(out).toEqual({ ok: true, value: "Nguyễn Văn An".normalize("NFC") });
    expect(out.ok && out.value === out.value.normalize("NFC")).toBe(true);
  });
});

describe("profilePatchInit", () => {
  it("builds PATCH with JSON body {displayName} only", () => {
    const init = profilePatchInit("Ann");
    expect(init.method).toBe("PATCH");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body as string)).toEqual({ displayName: "Ann" });
  });
});

describe("mapPatchResult", () => {
  it("200 + needsProfile false -> saved; 200 + needsProfile true -> retry", async () => {
    expect((await mapPatchResult({ res: json(me(false), 200) })).kind).toBe("saved");
    expect((await mapPatchResult({ res: json(me(true), 200) })).kind).toBe("retry");
    expect((await mapPatchResult({ res: json({}, 200) })).kind).toBe("retry");
  });

  it("the saved response body stays readable", async () => {
    const out = await mapPatchResult({ res: json(me(false), 200) });
    expect(out.kind === "saved" && (await out.res.json())).toMatchObject({ email: "a@b.co" });
  });

  it("400 -> invalid; 503 -> retry; a thrown network error -> retry; ApiAccessError -> access", async () => {
    expect(
      await mapPatchResult({ res: json({ error: { code: "invalid_request" } }, 400) }),
    ).toEqual({
      kind: "invalid",
    });
    expect(await mapPatchResult({ res: json({}, 503) })).toEqual({ kind: "retry" });
    expect(await mapPatchResult({ error: new TypeError("fetch failed") })).toEqual({
      kind: "retry",
    });
    const err = new ApiAccessError("forbidden");
    expect(await mapPatchResult({ error: err })).toEqual({ kind: "access", error: err });
  });
});
