import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAccountId, readAccountId, writeAccountId } from "./accountId";

const ID = "11111111-1111-4111-8111-111111111111";

/** The suite runs in the node env: stand in for `localStorage` (A8: no jsdom). */
function stubBrowser() {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  });
  vi.stubGlobal("sessionStorage", { length: 0 });
  vi.stubGlobal("history", { pushState: () => {}, replaceState: () => {} });
}
beforeEach(stubBrowser);
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("accountId", () => {
  it("round-trips a UUID under mm_account_id", () => {
    writeAccountId(ID);
    expect(localStorage.getItem("mm_account_id")).toBe(ID);
    expect(readAccountId()).toBe(ID);
    clearAccountId();
    expect(readAccountId()).toBeNull();
  });

  it("drops and removes a value that is not a UUID", () => {
    for (const v of ["garbage", "", "x".repeat(5000)]) {
      localStorage.setItem("mm_account_id", v);
      expect(readAccountId()).toBeNull();
      expect(localStorage.getItem("mm_account_id")).toBeNull();
    }
  });

  it("swallows storage errors", () => {
    vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(localStorage, "removeItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(readAccountId()).toBeNull();
    expect(() => writeAccountId(ID)).not.toThrow();
    expect(() => clearAccountId()).not.toThrow();
  });
});
