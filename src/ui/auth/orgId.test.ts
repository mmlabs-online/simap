import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearOrgId, readOrgId, writeOrgId } from "./orgId";

const A = "11111111-1111-4111-8111-111111111111";
const B = "33333333-3333-4333-8333-333333333333";
const ORG = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("orgId", () => {
  it("writes and reads per account (lowercased key and value); another account reads null", () => {
    writeOrgId(A.toUpperCase(), ORG.toUpperCase());
    expect(localStorage.getItem(`mm_org_id:${A}`)).toBe(ORG);
    expect(readOrgId(A)).toBe(ORG);
    expect(readOrgId(B)).toBeNull();
  });

  it("an invalid stored value reads null and is removed", () => {
    localStorage.setItem(`mm_org_id:${A}`, "not-a-uuid");
    expect(readOrgId(A)).toBeNull();
    expect(localStorage.getItem(`mm_org_id:${A}`)).toBeNull();
  });

  it("clear(account, onlyIf) clears only when the value equals onlyIf; clear(account) always", () => {
    writeOrgId(A, ORG);
    clearOrgId(A, B);
    expect(readOrgId(A)).toBe(ORG);
    clearOrgId(A, ORG.toUpperCase());
    expect(readOrgId(A)).toBeNull();
    writeOrgId(A, ORG);
    clearOrgId(A);
    expect(readOrgId(A)).toBeNull();
  });

  it("a throwing localStorage reads null and never throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    });
    expect(readOrgId(A)).toBeNull();
    expect(() => writeOrgId(A, ORG)).not.toThrow();
    expect(() => clearOrgId(A)).not.toThrow();
    expect(() => clearOrgId(A, ORG)).not.toThrow();
  });
});
