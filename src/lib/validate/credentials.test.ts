import { describe, expect, it } from "vitest";

import {
  confirmError,
  emailError,
  hasErrors,
  passwordError,
  signInPasswordError,
  validateSignIn,
  validateNewPassword,
  validateSignUp,
} from "./credentials";

describe("emailError", () => {
  it("empty → required", () => {
    expect(emailError("")).toBe("required");
    expect(emailError("   ")).toBe("required");
  });

  it("trims before checking", () => {
    expect(emailError("  an@vi.vn  ")).toBeNull();
  });

  it.each(["an.vi.vn", "an@vi", "a n@vi.vn", "a@@vi.vn", "an@.vn", "@vi.vn", "an@vi..vn"])(
    "%s → invalid",
    (v) => {
      expect(emailError(v)).toBe("invalid");
    },
  );

  it("length limits", () => {
    expect(emailError("a".repeat(64) + "@vi.vn")).toBeNull();
    expect(emailError("a".repeat(65) + "@vi.vn")).toBe("invalid");
    expect(emailError("a@" + "b".repeat(250) + ".vn")).toBe("invalid");
  });

  it("does not reject Unicode / IDN", () => {
    expect(emailError("người.dùng@ví-dụ.vn")).toBeNull();
  });
});

describe("passwordError (sign-up)", () => {
  it("empty → required", () => {
    expect(passwordError("")).toBe("required");
  });

  it("5 → tooShort, 6 → ok", () => {
    expect(passwordError("a".repeat(5))).toBe("tooShort");
    expect(passwordError("a".repeat(6))).toBeNull();
  });

  it("does not trim", () => {
    expect(passwordError(" " + "a".repeat(4) + " ")).toBeNull();
    expect(passwordError(" aaa ")).toBe("tooShort");
  });

  it("measures after NFKC", () => {
    expect(passwordError("é".repeat(5))).toBe("tooShort");
    expect(passwordError("mật k".normalize("NFD"))).toBe("tooShort");
    expect(passwordError("mật kh".normalize("NFD"))).toBeNull();
    expect(passwordError("ｍａｔｋｈ")).toBe("tooShort");
    expect(passwordError("ｍａｔｋｈａ")).toBeNull();
  });

  it("128 code points ok, 129 → tooLong", () => {
    expect(passwordError("😀".repeat(128))).toBeNull();
    expect(passwordError("a".repeat(129))).toBe("tooLong");
  });
});

describe("signInPasswordError", () => {
  it("no policy at sign-in", () => {
    expect(signInPasswordError("")).toBe("required");
    expect(signInPasswordError("abc")).toBeNull();
    expect(signInPasswordError("a".repeat(129))).toBe("tooLong");
  });
});

describe("confirmError", () => {
  it("mismatch and NFC vs NFD", () => {
    expect(confirmError("abc", "abd")).toBe("mismatch");
    const pw = "Mật khẩu của tôi";
    expect(confirmError(pw, pw.normalize("NFD"))).toBeNull();
  });
});

describe("form validation", () => {
  it("validateSignIn returns a field map", () => {
    expect(validateSignIn({ email: "", password: "" })).toEqual({
      email: "required",
      password: "required",
    });
    expect(hasErrors(validateSignIn({ email: "an@vi.vn", password: "x" }))).toBe(false);
  });

  it("validateSignUp returns a field map", () => {
    expect(validateSignUp({ email: "bad", password: "short", confirm: "" })).toEqual({
      email: "invalid",
      password: "tooShort",
      confirm: "required",
    });
    expect(validateSignUp({ email: "an@vi.vn", password: "a".repeat(12), confirm: "x" })).toEqual({
      confirm: "mismatch",
    });
    expect(
      hasErrors(
        validateSignUp({ email: "an@vi.vn", password: "a".repeat(12), confirm: "a".repeat(12) }),
      ),
    ).toBe(false);
  });
});

describe("validateNewPassword (same rules as sign-up)", () => {
  it("empty -> required / required", () => {
    expect(validateNewPassword({ password: "", confirm: "" })).toEqual({
      password: "required",
      confirm: "required",
    });
  });
  it("5 chars -> tooShort, 6 -> ok", () => {
    expect(validateNewPassword({ password: "a".repeat(5), confirm: "a".repeat(5) })).toEqual({
      password: "tooShort",
    });
    expect(
      hasErrors(validateNewPassword({ password: "a".repeat(6), confirm: "a".repeat(6) })),
    ).toBe(false);
  });
  it("NFKC: full-width digits count as the same characters, NFC and NFD match", () => {
    expect(passwordError("１".repeat(6))).toBeNull();
    expect(passwordError("１".repeat(5))).toBe("tooShort");
    const nfc = "caf\u00e9 caf\u00e9 caf\u00e9";
    expect(hasErrors(validateNewPassword({ password: nfc, confirm: nfc.normalize("NFD") }))).toBe(
      false,
    );
  });
  it("mismatch and tooLong", () => {
    expect(validateNewPassword({ password: "a".repeat(12), confirm: "b".repeat(12) })).toEqual({
      confirm: "mismatch",
    });
    expect(validateNewPassword({ password: "a".repeat(129), confirm: "a".repeat(129) })).toEqual({
      password: "tooLong",
    });
  });
});
