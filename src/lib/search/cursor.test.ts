import { describe, expect, it } from "vitest";
import { decodeSearchCursor, encodeSearchCursor } from "./cursor";

const ID = "33333333-3333-4333-8333-333333333333";
const enc = (v: unknown) => Buffer.from(JSON.stringify(v), "utf8").toString("base64url");

describe("search cursor", () => {
  it("round trip per kind; rejects bad base64, extra/missing keys, unknown t, non-canonical id, k > 320", () => {
    for (const t of ["seat", "device", "member"] as const) {
      for (const k of ["nguyễn văn a", "", "a"]) {
        expect(decodeSearchCursor(encodeSearchCursor({ t, k, id: ID }))).toEqual({ t, k, id: ID });
      }
    }
    for (const bad of ["a b", "", "e30=", "!!!"]) expect(decodeSearchCursor(bad)).toBeNull();
    expect(decodeSearchCursor(enc({ t: "seat", k: "a", id: ID, x: 1 }))).toBeNull();
    expect(decodeSearchCursor(enc({ k: "a", id: ID }))).toBeNull();
    expect(decodeSearchCursor(enc({ t: "seat", k: "a" }))).toBeNull();
    expect(decodeSearchCursor(enc({ t: "room", k: "a", id: ID }))).toBeNull();
    expect(decodeSearchCursor(enc({ t: "seat", k: "a", id: "nope" }))).toBeNull();
    expect(decodeSearchCursor(enc({ t: "seat", k: 5, id: ID }))).toBeNull();
    expect(decodeSearchCursor(enc({ t: "seat", k: "a".repeat(321), id: ID }))).toBeNull();
    expect(decodeSearchCursor(enc({ t: "seat", k: "a".repeat(320), id: ID }))).not.toBeNull();
    expect(decodeSearchCursor(enc([ID]))).toBeNull();
    expect(decodeSearchCursor(enc(null))).toBeNull();
  });
});
