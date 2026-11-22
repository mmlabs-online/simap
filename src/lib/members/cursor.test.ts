import { describe, expect, it } from "vitest";
import { decodeMemberCursor, encodeMemberCursor } from "./cursor";

const ID = "33333333-3333-4333-8333-333333333333";
const enc = (v: unknown) => Buffer.from(JSON.stringify(v), "utf8").toString("base64url");

describe("member cursor", () => {
  it("round-trips, including a Vietnamese key", () => {
    for (const k of ["nguyễn văn a", "", "a"]) {
      expect(decodeMemberCursor(encodeMemberCursor({ k, id: ID }))).toEqual({ k, id: ID });
    }
  });
  it("rejects non-base64url input", () => {
    expect(decodeMemberCursor("a b")).toBeNull();
    expect(decodeMemberCursor("")).toBeNull();
    expect(decodeMemberCursor("e30=")).toBeNull();
    expect(decodeMemberCursor("!!!")).toBeNull();
  });
  it("rejects extra or missing keys, non-uuid id, non-string k, k over 320 code points", () => {
    expect(decodeMemberCursor(enc({ k: "a", id: ID, x: 1 }))).toBeNull();
    expect(decodeMemberCursor(enc({ k: "a" }))).toBeNull();
    expect(decodeMemberCursor(enc({ k: "a", id: "nope" }))).toBeNull();
    expect(decodeMemberCursor(enc({ k: 5, id: ID }))).toBeNull();
    expect(decodeMemberCursor(enc({ k: "a".repeat(321), id: ID }))).toBeNull();
    expect(decodeMemberCursor(enc({ k: "a".repeat(320), id: ID }))).not.toBeNull();
    expect(decodeMemberCursor(enc([ID]))).toBeNull();
    expect(decodeMemberCursor(enc(null))).toBeNull();
  });
});
