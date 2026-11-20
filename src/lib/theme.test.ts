import { describe, expect, it } from "vitest";
import {
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  nextTheme,
  parseTheme,
  readStoredTheme,
  resolveTheme,
  writeStoredTheme,
} from "./theme";

describe("parseTheme", () => {
  it("accepts only light and dark", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    for (const v of [null, undefined, "", "Dark", "system", "x"]) expect(parseTheme(v)).toBeNull();
  });
});

describe("resolveTheme", () => {
  it("stored wins, else system", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme(null, false)).toBe("light");
    expect(nextTheme("dark")).toBe("light");
    expect(nextTheme("light")).toBe("dark");
  });
});

describe("readStoredTheme / writeStoredTheme", () => {
  it("round-trips through a storage stub", () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
    };
    expect(readStoredTheme(storage)).toBeNull();
    writeStoredTheme(storage, "dark");
    expect(map.get(THEME_STORAGE_KEY)).toBe("dark");
    expect(readStoredTheme(storage)).toBe("dark");
    map.set(THEME_STORAGE_KEY, "bogus");
    expect(readStoredTheme(storage)).toBeNull();
  });
  it("tolerates a throwing storage", () => {
    const boom = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readStoredTheme(boom)).toBeNull();
    expect(() => writeStoredTheme(boom, "dark")).not.toThrow();
  });
});

describe("THEME_INIT_SCRIPT", () => {
  function run(stored: string | null | "throw", prefersDark: boolean) {
    const doc = { documentElement: { dataset: {} as Record<string, string> } };
    const localStorage = {
      getItem: () => {
        if (stored === "throw") throw new Error("blocked");
        return stored;
      },
    };
    const matchMedia = () => ({ matches: prefersDark });
    new Function("localStorage", "matchMedia", "document", THEME_INIT_SCRIPT)(
      localStorage,
      matchMedia,
      doc,
    );
    return doc.documentElement.dataset.theme;
  }
  it("sets data-theme before paint", () => {
    expect(run("dark", false)).toBe("dark");
    expect(run("light", true)).toBe("light");
    expect(run(null, true)).toBe("dark");
    expect(run("nope", false)).toBe("light");
    expect(run("throw", true)).toBe("light");
  });
});
