import { describe, expect, it } from "vitest";
import { parseProviderPull } from "./provider-checkin";

const SUB = "5b0c9a4e-1f3d-4c6a-9d2e-7a8b1c2d3e4f";
const email = (value: unknown, roomCode: unknown = "C302", at?: unknown) => ({
  member: { kind: "email", value },
  roomCode,
  ...(at === undefined ? {} : { at }),
});

describe("parseProviderPull", () => {
  it("accepts email and sub members with an optional at", () => {
    const r = parseProviderPull({
      checkIns: [
        email(" a@example.com ", " c302 ", "2026-11-26T01:00:00Z"),
        { member: { kind: "sub", value: SUB }, roomCode: "R1" },
      ],
    });
    expect(r).toEqual({
      items: [
        {
          member: { kind: "email", value: "a@example.com" },
          roomCode: "C302",
          at: "2026-11-26T01:00:00Z",
        },
        { member: { kind: "sub", value: SUB }, roomCode: "R1" },
      ],
      dropped: 0,
    });
  });
  it("non-object or a missing array -> null", () => {
    for (const raw of [null, undefined, "x", 3, [], {}, { checkIns: "x" }]) {
      expect(parseProviderPull(raw)).toBeNull();
    }
  });
  it("drops bad items and counts them", () => {
    const r = parseProviderPull({
      checkIns: [
        email("a@example.com"),
        { member: { kind: "phone", value: "1" }, roomCode: "R1" },
        email(""),
        email("no-at-sign"),
        email(`${"a".repeat(320)}@x`),
        email("a@example.com", ""),
        email("a@example.com", "R".repeat(33)),
        email("a@example.com", 5),
        { member: { kind: "sub", value: "not-a-uuid" }, roomCode: "R1" },
        { member: { kind: "sub", value: SUB.toUpperCase() }, roomCode: "R1" },
        email("a@example.com", "R1", 123),
        null,
        "x",
        { roomCode: "R1" },
      ],
    });
    expect(r?.items).toHaveLength(1);
    expect(r?.dropped).toBe(13);
  });
  it("more than 1000 items -> null", () => {
    const checkIns = Array.from({ length: 1001 }, () => email("a@example.com"));
    expect(parseProviderPull({ checkIns })).toBeNull();
    expect(parseProviderPull({ checkIns: checkIns.slice(1) })?.items).toHaveLength(1000);
  });
  it("keeps Vietnamese diacritics in values untouched", () => {
    const v = "nguyễn.văn@example.com";
    expect(parseProviderPull({ checkIns: [email(v)] })?.items[0]?.member.value).toBe(v);
  });
});
