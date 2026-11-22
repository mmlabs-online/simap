import { describe, expect, it } from "vitest";
import {
  defaultDisplayName,
  normalizeDisplayName,
  normalizeEmployeeCode,
  validateDeactivateBody,
  validateMePatch,
  validateMemberPatch,
} from "./member";

const NFD = "Nguyễn Văn A".normalize("NFD");

describe("defaultDisplayName", () => {
  it.each([
    ["nguyen.van.a@x.vn", "nguyen.van.a"],
    ["a+tag@x", "a+tag"],
    ['"a@b"@x.com', '"a@b"'],
    ["  a  b @x", "a b"],
    ["@x.com", "@x.com"],
    ["plain", "plain"],
    ["\u0007 \u0007@x.vn", "@x.vn"],
    ["\u200Ba\u202Eb@x.vn", "ab"],
    ["\u3164@x.vn", "@x.vn"],
    ["\u0007 \u0007", "member"],
  ])("%s -> %s", (email, out) => {
    expect(defaultDisplayName(email)).toBe(out);
  });

  it("NFD local part -> NFC", () => {
    expect(defaultDisplayName(`${NFD}@x.vn`)).toBe("Nguyễn Văn A".normalize("NFC"));
  });

  it("100-char local part -> 80 code points, no trailing space", () => {
    const out = defaultDisplayName(`${"ab ".repeat(40)}${"c".repeat(20)}@x.vn`);
    expect([...out].length).toBeLessThanOrEqual(80);
    expect(out).toBe(out.trimEnd());
    expect(out.startsWith("ab ab")).toBe(true);
  });
});

describe("normalizeDisplayName", () => {
  it("NFD input -> NFC, trimmed, whitespace collapsed", () => {
    expect(normalizeDisplayName(NFD)).toBe("Nguyễn Văn A".normalize("NFC"));
    expect(normalizeDisplayName("  a \t\n b ")).toBe("a b");
  });

  it.each(
    [
      [
        "",
        "   ",
        1,
        null,
        undefined,
        "a\u0007b",
        "a\u007fb",
        "\u200B",
        "a\u202Eb",
        "\u3164",
        "\u0301",
        "a\u200Db",
      ],
    ].flat(),
  )("rejects %j", (v) => {
    expect(normalizeDisplayName(v)).toBeNull();
  });

  it("counts code points: 80 emoji ok, 81 rejected", () => {
    expect(normalizeDisplayName("😀".repeat(80))).toBe("😀".repeat(80));
    expect(normalizeDisplayName("😀".repeat(81))).toBeNull();
    expect(normalizeDisplayName("a".repeat(81))).toBeNull();
  });
});

describe("validateMePatch", () => {
  it("accepts {displayName}", () => {
    expect(validateMePatch({ displayName: " x " })).toEqual({
      ok: true,
      value: { displayName: "x" },
    });
  });

  it.each([{}, [], null, "x", { displayName: "x", sub: "s" }, { displayName: 1 }])(
    "rejects %j",
    (b) => {
      expect(validateMePatch(b).ok).toBe(false);
    },
  );
});

const GID = "44444444-4444-4444-8444-444444444444";

describe("normalizeEmployeeCode", () => {
  it("trims, uppercases, accepts A-Z 0-9 . _ - up to 32", () => {
    expect(normalizeEmployeeCode("  e1 ")).toBe("E1");
    expect(normalizeEmployeeCode("ab.c_d-9")).toBe("AB.C_D-9");
    expect(normalizeEmployeeCode("A".repeat(32))).toBe("A".repeat(32));
  });
  it("rejects inner spaces, diacritics, control chars, 33 chars, empty, non-strings", () => {
    for (const v of ["a b", "É1", "ß", "a\u0007", "a\nb", "A".repeat(33), "", "  ", 5, null, {}]) {
      expect(normalizeEmployeeCode(v)).toBeNull();
    }
  });
});

describe("validateMemberPatch", () => {
  it("each field alone and all three", () => {
    expect(validateMemberPatch({ displayName: " Nguyễn  Văn " })).toEqual({
      ok: true,
      value: { displayName: "Nguyễn Văn" },
    });
    expect(validateMemberPatch({ employeeCode: "e1" })).toEqual({
      ok: true,
      value: { employeeCode: "E1" },
    });
    expect(validateMemberPatch({ groupId: GID })).toEqual({ ok: true, value: { groupId: GID } });
    expect(validateMemberPatch({ displayName: "A", employeeCode: "x", groupId: null })).toEqual({
      ok: true,
      value: { displayName: "A", employeeCode: "X", groupId: null },
    });
  });
  it("keeps Vietnamese NFC", () => {
    expect(validateMemberPatch({ displayName: NFD })).toEqual({
      ok: true,
      value: { displayName: "Nguyễn Văn A" },
    });
  });
  it("empty object, array, unknown key -> field error", () => {
    expect(validateMemberPatch({})).toEqual({ ok: false, field: "body" });
    expect(validateMemberPatch([])).toEqual({ ok: false, field: "body" });
    expect(validateMemberPatch(null)).toEqual({ ok: false, field: "body" });
    expect(validateMemberPatch({ email: "a@b" })).toEqual({ ok: false, field: "email" });
    expect(validateMemberPatch({ displayName: "A", status: "x" })).toEqual({
      ok: false,
      field: "status",
    });
  });
  it("employeeCode empty, blank or null -> null; bad -> error", () => {
    for (const v of ["", "  ", null]) {
      expect(validateMemberPatch({ employeeCode: v })).toEqual({
        ok: true,
        value: { employeeCode: null },
      });
    }
    expect(validateMemberPatch({ employeeCode: "a b" })).toEqual({
      ok: false,
      field: "employeeCode",
    });
    expect(validateMemberPatch({ employeeCode: 3 })).toEqual({
      ok: false,
      field: "employeeCode",
    });
  });
  it("groupId non-canonical -> error; displayName invalid -> error", () => {
    expect(validateMemberPatch({ groupId: "nope" })).toEqual({ ok: false, field: "groupId" });
    expect(validateMemberPatch({ groupId: "" })).toEqual({ ok: false, field: "groupId" });
    expect(validateMemberPatch({ displayName: "   " })).toEqual({
      ok: false,
      field: "displayName",
    });
  });
});

describe("validateDeactivateBody", () => {
  it("{release:true/false} ok", () => {
    expect(validateDeactivateBody({ release: true })).toEqual({
      ok: true,
      value: { release: true },
    });
    expect(validateDeactivateBody({ release: false })).toEqual({
      ok: true,
      value: { release: false },
    });
  });
  it("missing, non-boolean, extra key, non-object -> error", () => {
    expect(validateDeactivateBody({})).toEqual({ ok: false, field: "release" });
    expect(validateDeactivateBody({ release: "true" })).toEqual({ ok: false, field: "release" });
    expect(validateDeactivateBody({ release: true, x: 1 })).toEqual({ ok: false, field: "x" });
    expect(validateDeactivateBody(null)).toEqual({ ok: false, field: "body" });
    expect(validateDeactivateBody([])).toEqual({ ok: false, field: "body" });
  });
});
