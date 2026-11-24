import { describe, expect, it } from "vitest";
import {
  validateGroupCreate,
  validateGroupPatch,
  validateProjectCreate,
  validateProjectPatch,
  validateSeatTags,
} from "./group";

const U = "33333333-3333-4333-8333-333333333333";

describe("validateGroupCreate", () => {
  it("trims and NFC-normalises the name, keeps the colour", () => {
    expect(validateGroupCreate({ name: "  Café ", color: "#5B6CF0" })).toEqual({
      ok: true,
      value: { name: "Café", color: "#5B6CF0" },
    });
  });
  it("rejects empty, blank and too long names", () => {
    for (const name of ["", "   ", "x".repeat(61), 5]) {
      expect(validateGroupCreate({ name, color: "#aabbcc" })).toEqual({ ok: false, field: "name" });
    }
  });
  it("rejects bad colours", () => {
    for (const color of ["#fff", "red", "#aabbccdd", "aabbcc", undefined, 1]) {
      expect(validateGroupCreate({ name: "a", color })).toEqual({ ok: false, field: "color" });
    }
  });
  it("rejects unknown keys and non-objects", () => {
    expect(validateGroupCreate({ name: "a", color: "#aabbcc", x: 1 })).toEqual({
      ok: false,
      field: "x",
    });
    expect(validateGroupCreate([])).toEqual({ ok: false, field: "body" });
  });
});

describe("validateGroupPatch", () => {
  it("accepts a single field", () => {
    expect(validateGroupPatch({ color: "#000000" })).toEqual({
      ok: true,
      value: { color: "#000000" },
    });
  });
  it("rejects an empty patch and bad values", () => {
    expect(validateGroupPatch({})).toEqual({ ok: false, field: "body" });
    expect(validateGroupPatch({ name: "" })).toEqual({ ok: false, field: "name" });
    expect(validateGroupPatch({ color: "x" })).toEqual({ ok: false, field: "color" });
  });
});

describe("validateProjectCreate / Patch", () => {
  it("uppercases the code", () => {
    expect(validateProjectCreate({ code: " alpha-1 ", name: " Alpha " })).toEqual({
      ok: true,
      value: { code: "ALPHA-1", name: "Alpha" },
    });
    expect(validateProjectPatch({ code: "b2" })).toEqual({ ok: true, value: { code: "B2" } });
  });
  it("rejects bad codes, names, unknown keys and empty patch", () => {
    expect(validateProjectCreate({ code: "a b", name: "n" })).toEqual({ ok: false, field: "code" });
    expect(validateProjectCreate({ code: "x".repeat(33), name: "n" })).toEqual({
      ok: false,
      field: "code",
    });
    expect(validateProjectCreate({ code: "A", name: "" })).toEqual({ ok: false, field: "name" });
    expect(validateProjectCreate({ code: "A", name: "n", z: 1 })).toEqual({
      ok: false,
      field: "z",
    });
    expect(validateProjectPatch({})).toEqual({ ok: false, field: "body" });
  });
});

describe("validateSeatTags", () => {
  it("accepts uuid, null, both", () => {
    expect(validateSeatTags({ groupId: U })).toEqual({ ok: true, value: { groupId: U } });
    expect(validateSeatTags({ projectId: null })).toEqual({
      ok: true,
      value: { projectId: null },
    });
    expect(validateSeatTags({ groupId: null, projectId: U })).toEqual({
      ok: true,
      value: { groupId: null, projectId: U },
    });
  });
  it("rejects neither key, non-uuid, unknown keys", () => {
    expect(validateSeatTags({})).toEqual({ ok: false, field: "body" });
    expect(validateSeatTags({ groupId: "abc" })).toEqual({ ok: false, field: "groupId" });
    expect(validateSeatTags({ projectId: 5 })).toEqual({ ok: false, field: "projectId" });
    expect(validateSeatTags({ groupId: U, other: 1 })).toEqual({ ok: false, field: "other" });
  });
});
