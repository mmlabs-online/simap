import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "./cursor";

const ID = "33333333-3333-4333-8333-333333333333";
const AT = "2026-11-20T08:46:02.123456Z";
const enc = (v: unknown) => Buffer.from(JSON.stringify(v), "utf8").toString("base64url");

describe("audit cursor", () => {
  it("round trip keeps microseconds", () => {
    expect(decodeCursor(encodeCursor({ at: AT, id: ID }))).toEqual({ at: AT, id: ID });
  });

  it("garbage / wrong shape / non-uuid id / bad base64 -> null", () => {
    expect(decodeCursor("")).toBeNull();
    expect(decodeCursor("!!!")).toBeNull();
    expect(decodeCursor("abc")).toBeNull();
    expect(decodeCursor(enc([AT, ID]))).toBeNull();
    expect(decodeCursor(enc("x"))).toBeNull();
    expect(decodeCursor(enc({ at: AT, id: "nope" }))).toBeNull();
    expect(decodeCursor(enc({ at: "2026-11-20T08:46:02Z", id: ID }))).toBeNull();
    expect(decodeCursor(enc({ at: "2026-13-20T08:46:02.123456Z", id: ID }))).toBeNull();
    expect(decodeCursor(enc({ at: 1, id: ID }))).toBeNull();
  });

  it("never accepts extra keys", () => {
    expect(decodeCursor(enc({ at: AT, id: ID, org: "x" }))).toBeNull();
    expect(decodeCursor(enc({ at: AT }))).toBeNull();
  });
});
