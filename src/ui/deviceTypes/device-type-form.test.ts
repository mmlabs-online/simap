import { describe, expect, it } from "vitest";
import type { DeviceTypeDto } from "@/lib/device-types/types";
import { deviceTypesCopy } from "../copy/deviceTypes";
import { emptyForm, formFromType, toCreateBody, toPatchBody } from "./device-type-form";

const type: DeviceTypeDto = {
  id: "1",
  name: "Máy in",
  slot: "other",
  hasImage: false,
  imageVersion: 0,
  sprite: null,
};
const msg = deviceTypesCopy.fieldErrors;

describe("toCreateBody", () => {
  it("trims, collapses spaces and keeps diacritics", () => {
    expect(toCreateBody({ name: "Máy  in ", slot: "pc", sprite: null })).toEqual({
      kind: "ok",
      body: { name: "Máy in", slot: "pc", sprite: null },
    });
  });
  it("empty, whitespace, too long and control names are invalid", () => {
    for (const name of ["", "   ", "a".repeat(61), "a\u0007b"]) {
      expect(toCreateBody({ name, slot: "pc", sprite: null })).toEqual({
        kind: "invalid",
        message: msg.name,
      });
    }
  });
  it("a slot outside the list is invalid", () => {
    const form = { name: "x", slot: "desk", sprite: null } as unknown as ReturnType<
      typeof emptyForm
    >;
    expect(toCreateBody(form)).toEqual({ kind: "invalid", message: msg.slot });
  });
  it("the empty form uses slot other", () => {
    expect(emptyForm().slot).toBe("other");
  });
});

describe("toPatchBody", () => {
  it("same name (spaces) and same slot is unchanged", () => {
    expect(toPatchBody({ name: " Máy  in ", slot: "other", sprite: null }, type)).toEqual({
      kind: "unchanged",
    });
    expect(toPatchBody(formFromType(type), type)).toEqual({ kind: "unchanged" });
  });
  it("sends only the changed field", () => {
    expect(toPatchBody({ name: "Scanner", slot: "other", sprite: null }, type)).toEqual({
      kind: "ok",
      body: { name: "Scanner" },
    });
    expect(toPatchBody({ name: "Máy in", slot: "pc", sprite: null }, type)).toEqual({
      kind: "ok",
      body: { slot: "pc" },
    });
  });
  it("a case-only rename is sent; an invalid name is refused", () => {
    expect(toPatchBody({ name: "máy in", slot: "other", sprite: null }, type)).toEqual({
      kind: "ok",
      body: { name: "máy in" },
    });
    expect(toPatchBody({ name: " ", slot: "other", sprite: null }, type)).toEqual({
      kind: "invalid",
      message: msg.name,
    });
  });
  it("toPatchBody sends sprite only when changed; clear sends null", () => {
    expect(toPatchBody({ name: "Máy in", slot: "other", sprite: "device.pc" }, type)).toEqual({
      kind: "ok",
      body: { sprite: "device.pc" },
    });
    const picked = { ...type, sprite: "device.pc" };
    expect(toPatchBody({ name: "Máy in", slot: "other", sprite: null }, picked)).toEqual({
      kind: "ok",
      body: { sprite: null },
    });
    expect(toPatchBody({ name: "Máy in", slot: "other", sprite: "device.pc" }, picked)).toEqual({
      kind: "unchanged",
    });
    const renamed = toPatchBody({ name: "Scanner", slot: "other", sprite: "device.pc" }, picked);
    expect(renamed).toEqual({ kind: "ok", body: { name: "Scanner" } });
    expect(renamed.kind === "ok" && "sprite" in renamed.body).toBe(false);
  });
});
