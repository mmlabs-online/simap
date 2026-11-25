import { describe, expect, it } from "vitest";
import { DEVICE_KINDS } from "@/lib/device-types/types";
import { apiCopy } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import {
  DIAGRAM,
  canManageDeviceTypes,
  settleDelete,
  settleSave,
  slotMarker,
  typeSuggestions,
} from "./device-types-state";

describe("canManageDeviceTypes", () => {
  it("only admin", () => {
    expect(canManageDeviceTypes("admin")).toBe(true);
    expect(canManageDeviceTypes("manager")).toBe(false);
    expect(canManageDeviceTypes("user")).toBe(false);
    expect(canManageDeviceTypes(undefined)).toBe(false);
  });
});

describe("settleSave / settleDelete", () => {
  it("ok and not_found are done", () => {
    expect(settleSave({ ok: true, value: null })).toEqual({ kind: "done" });
    expect(settleSave({ ok: false, code: "not_found" })).toEqual({ kind: "done" });
    expect(settleDelete({ ok: false, code: "not_found" })).toEqual({ kind: "done" });
  });
  it("server refusals give the api copy; an unknown code the generic text", () => {
    for (const code of ["name_taken", "type_limit", "invalid_request"] as const) {
      expect(settleSave({ ok: false, code })).toEqual({
        kind: "error",
        message: apiCopy.errors[code],
      });
    }
    expect(settleSave({ ok: false, code: "weird" })).toEqual({
      kind: "error",
      message: apiCopy.errors.internal,
    });
    expect(settleDelete({ ok: false, code: "unavailable" })).toEqual({
      kind: "error",
      message: apiCopy.errors.unavailable,
    });
  });
});

describe("typeSuggestions", () => {
  it("loading and error give the D37 seed list", () => {
    expect(typeSuggestions({ status: "loading" })).toEqual(devicesCopy.typeSuggestions);
    expect(typeSuggestions({ status: "error" })).toEqual(devicesCopy.typeSuggestions);
  });
  it("ready gives the catalog names in order, empty gives none", () => {
    expect(typeSuggestions({ status: "ready", names: ["B", "A"] })).toEqual(["B", "A"]);
    expect(typeSuggestions({ status: "ready", names: [] })).toEqual([]);
  });
});

describe("slotMarker", () => {
  it("pc is under the desk and monitor sits at the back", () => {
    expect(slotMarker("pc").under).toBe(true);
    expect(slotMarker("monitor").under).toBe(false);
    expect(slotMarker("monitor").y).toBeLessThan(DIAGRAM.deskY + DIAGRAM.deskH / 2);
  });
  it("every kind is inside the diagram", () => {
    for (const k of DEVICE_KINDS) {
      const m = slotMarker(k);
      expect(m.x).toBeGreaterThan(0);
      expect(m.x).toBeLessThan(DIAGRAM.w);
      expect(m.y).toBeGreaterThan(0);
      expect(m.y).toBeLessThan(DIAGRAM.h);
    }
  });
});
