import { describe, expect, it } from "vitest";
import { decodeMyDevicesCursor, encodeMyDevicesCursor } from "./cursor";

const ID = "33333333-3333-4333-8333-333333333333";
const enc = (v: unknown) => Buffer.from(JSON.stringify(v), "utf8").toString("base64url");

describe("my devices cursor", () => {
  it("round-trips, including a Vietnamese key", () => {
    for (const k of ["đèn bàn", "", "a"]) {
      expect(decodeMyDevicesCursor(encodeMyDevicesCursor({ k, id: ID }))).toEqual({ k, id: ID });
    }
  });
  it("rejects non-base64url input", () => {
    expect(decodeMyDevicesCursor("a b")).toBeNull();
    expect(decodeMyDevicesCursor("")).toBeNull();
    expect(decodeMyDevicesCursor("e30=")).toBeNull();
    expect(decodeMyDevicesCursor("!!!")).toBeNull();
  });
  it("rejects extra or missing keys, non-uuid id, non-string k, k over 480 code points, arrays", () => {
    expect(decodeMyDevicesCursor(enc({ k: "a", id: ID, x: 1 }))).toBeNull();
    expect(decodeMyDevicesCursor(enc({ k: "a" }))).toBeNull();
    expect(decodeMyDevicesCursor(enc({ k: "a", id: "nope" }))).toBeNull();
    expect(decodeMyDevicesCursor(enc({ k: 5, id: ID }))).toBeNull();
    expect(decodeMyDevicesCursor(enc({ k: "a".repeat(481), id: ID }))).toBeNull();
    expect(decodeMyDevicesCursor(enc({ k: "a".repeat(480), id: ID }))).not.toBeNull();
    expect(decodeMyDevicesCursor(enc([ID]))).toBeNull();
    expect(decodeMyDevicesCursor(enc(null))).toBeNull();
  });
});
