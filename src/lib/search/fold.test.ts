import { describe, expect, it } from "vitest";
import { FOLD_FROM, FOLD_TO, foldSql, foldText, macCompact } from "./fold";

describe("foldText", () => {
  it("folds Nguyễn, NGUYỄN and NFD input to nguyen; Đ/đ to d", () => {
    expect(foldText("Nguyễn")).toBe("nguyen");
    expect(foldText("NGUYỄN")).toBe("nguyen");
    expect(foldText("Nguyễn".normalize("NFD"))).toBe("nguyen");
    expect(foldText("Đặng Dũng đ")).toBe("dang dung d");
  });

  it("Vietnamese alphabet: 12 vowels x 6 tones, both cases, NFC and NFD", () => {
    const vowels: [string, string][] = [
      ["a", "a"],
      ["ă", "a"],
      ["â", "a"],
      ["e", "e"],
      ["ê", "e"],
      ["i", "i"],
      ["o", "o"],
      ["ô", "o"],
      ["ơ", "o"],
      ["u", "u"],
      ["ư", "u"],
      ["y", "y"],
    ];
    // none, grave, acute, hook above, tilde, dot below
    const tones = ["", "\u0300", "\u0301", "\u0309", "\u0303", "\u0323"];
    for (const [v, base] of vowels) {
      for (const t of tones) {
        for (const ch of [v, v.toUpperCase()]) {
          const nfd = (ch.normalize("NFD") + t).normalize("NFD");
          const nfc = nfd.normalize("NFC");
          expect(foldText(nfd), nfd).toBe(base);
          expect(foldText(nfc), nfc).toBe(base);
          for (const c of nfc) {
            if (c.charCodeAt(0) > 0x7f) expect(FOLD_FROM.includes(c), c).toBe(true);
          }
        }
      }
    }
  });

  it("every FOLD_FROM char folds to the FOLD_TO char at the same index", () => {
    const from = [...FOLD_FROM];
    const to = [...FOLD_TO];
    expect(from.length).toBeGreaterThan(100);
    from.forEach((c, i) => expect(foldText(c), c).toBe(to[i]));
  });

  it("map has equal lengths, no duplicates, no quote or backslash, ASCII a-z targets", () => {
    const from = [...FOLD_FROM];
    expect(from.length).toBe([...FOLD_TO].length);
    expect(new Set(from).size).toBe(from.length);
    expect(FOLD_FROM).not.toMatch(/['\\]/);
    expect(FOLD_TO).toMatch(/^[a-z]+$/);
  });

  it("ASCII, digits, %, _, \\, space and non-Latin text pass through lowercased only", () => {
    expect(foldText("AB-12 %_\\ x")).toBe("ab-12 %_\\ x");
    expect(foldText("東京 Москва")).toBe("東京 москва");
  });
});

describe("foldSql", () => {
  it("builds lower(translate(col, '<FROM>', '<TO>')) from constants", () => {
    expect(foldSql("m.display_name")).toBe(
      `lower(translate(m.display_name, '${FOLD_FROM}', '${FOLD_TO}'))`,
    );
  });
});

describe("macCompact", () => {
  it("aa:bb, AA-BB, aabb.cc, aabb -> hex; non-hex, empty, >12 hex -> null", () => {
    expect(macCompact("aa:bb")).toBe("aabb");
    expect(macCompact("AA-BB")).toBe("aabb");
    expect(macCompact("aabb.cc")).toBe("aabbcc");
    expect(macCompact("aabb")).toBe("aabb");
    expect(macCompact("xyz")).toBeNull();
    expect(macCompact("")).toBeNull();
    expect(macCompact("::")).toBeNull();
    expect(macCompact("aabbccddeeff")).toBe("aabbccddeeff");
    expect(macCompact("aabbccddeeff0")).toBeNull();
  });
});
