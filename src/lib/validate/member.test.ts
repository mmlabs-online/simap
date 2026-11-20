import { describe, expect, it } from "vitest";
import { defaultDisplayName, normalizeDisplayName, validateMePatch } from "./member";

const NFD = "Nguyễn Văn A".normalize("NFD");

describe("defaultDisplayName", () => {
  it.each([
    ["nguyen.van.a@x.vn", "nguyen.van.a"],
    ["a+tag@x", "a+tag"],
    ['"a@b"@x.com', '"a@b"'],
    ["  a  b @x", "a b"],
    ["@x.com", "@x.com"],
    ["plain", "plain"],
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

  it.each([["", "   ", 1, null, undefined, "a\u0007b", "a\u007fb"]].flat())("rejects %j", (v) => {
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
