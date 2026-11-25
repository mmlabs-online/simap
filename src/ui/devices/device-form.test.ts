import { describe, expect, it } from "vitest";
import type { DeviceDto } from "@/lib/devices/types";
import { apiCopy, apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import {
  deviceErrorMessage,
  emptyForm,
  filterAfterCreate,
  formFromDevice,
  toCreateBody,
  toPatchBody,
  type DeviceForm,
} from "./device-form";

const UUID = "11111111-1111-4111-8111-111111111111";
const fe = devicesCopy.form.fieldErrors;
const filled = (over: Partial<DeviceForm> = {}): DeviceForm => ({
  name: "Desk PC",
  type: "PC",
  inventoryNumber: "INV-1",
  mac: "",
  serial: "",
  manufacturer: "",
  brand: "",
  ...over,
});
const device: DeviceDto = {
  id: "d1",
  name: "Desk PC",
  type: "PC",
  inventoryNumber: "INV-1",
  mac: "aa:bb:cc:dd:ee:ff",
  owner: { id: UUID, displayName: "Ha" },
  placement: null,
  mine: true,
  canEdit: true,
  canPlace: true,
  canDelete: false,
  serial: null,
  manufacturer: null,
  brand: null,
  holding: null,
  canAssign: false,
  canEditHolding: false,
  canTransfer: false,
  pendingHandoff: null,
};
const body = (r: ReturnType<typeof toCreateBody>) => {
  if (r.kind !== "ok") throw new Error("expected ok");
  return r.body;
};

describe("form setup", () => {
  it("emptyForm and formFromDevice", () => {
    expect(emptyForm()).toEqual({
      name: "",
      type: "",
      inventoryNumber: "",
      mac: "",
      serial: "",
      manufacturer: "",
      brand: "",
    });
    expect(formFromDevice(device)).toMatchObject({ serial: "", manufacturer: "", brand: "" });
    expect(
      formFromDevice({ ...device, serial: "S1", manufacturer: "Dell", brand: "XPS" }),
    ).toMatchObject({ serial: "S1", manufacturer: "Dell", brand: "XPS" });
    expect(formFromDevice({ ...device, mac: null }).mac).toBe("");
    expect(formFromDevice(device)).toMatchObject({ mac: device.mac });
  });
});

describe("toCreateBody", () => {
  it("sends the form fields; the optional serial, manufacturer and brand stay null until the form has them (a new device has no owner)", () => {
    expect(body(toCreateBody(filled()))).toEqual({
      name: "Desk PC",
      type: "PC",
      inventoryNumber: "INV-1",
      mac: null,
      serial: null,
      manufacturer: null,
      brand: null,
    });
  });
  it("sends trimmed serial, manufacturer and brand; blank is null; 101 chars is invalid", () => {
    const b = body(toCreateBody(filled({ serial: " SN-1 ", manufacturer: "Dell", brand: "  " })));
    expect(b).toMatchObject({ serial: "SN-1", manufacturer: "Dell", brand: null });
    expect(toCreateBody(filled({ serial: "a".repeat(101) }))).toEqual({
      kind: "invalid",
      message: fe.serial,
    });
    expect(toCreateBody(filled({ brand: "a".repeat(101) }))).toEqual({
      kind: "invalid",
      message: fe.brand,
    });
  });
  it("normalises the MAC; blank is null; garbage is invalid", () => {
    const mac = (m: string) => toCreateBody(filled({ mac: m }));
    expect(body(mac("AA-BB-CC-DD-EE-FF")).mac).toBe("aa:bb:cc:dd:ee:ff");
    expect(body(mac("aabb.ccdd.eeff")).mac).toBe("aa:bb:cc:dd:ee:ff");
    expect(body(mac("AABBCCDDEEFF")).mac).toBe("aa:bb:cc:dd:ee:ff");
    expect(body(mac("  ")).mac).toBeNull();
    expect(mac("zz:bb:cc:dd:ee:ff")).toEqual({ kind: "invalid", message: fe.mac });
  });
  it("field messages, length limit and NFC trimming", () => {
    const run = (over: Partial<DeviceForm>) => toCreateBody(filled(over));
    expect(run({ name: " " })).toEqual({ kind: "invalid", message: fe.name });
    expect(run({ type: "" })).toEqual({ kind: "invalid", message: fe.type });
    expect(run({ inventoryNumber: "" })).toEqual({ kind: "invalid", message: fe.inventoryNumber });
    expect(run({ name: "a".repeat(121) })).toEqual({ kind: "invalid", message: fe.name });
    expect(body(run({ name: "  Máy trạm  " })).name).toBe("Máy trạm");
    expect(body(run({ name: "Máy" })).name).toBe("Máy");
  });
});

describe("toPatchBody", () => {
  const same = formFromDevice(device);
  it("patch sends only changed fields", () => {
    expect(toPatchBody({ ...same, type: "Laptop" }, device)).toEqual({
      kind: "ok",
      body: { type: "Laptop" },
    });
  });
  it("nothing changed is unchanged, also for whitespace and NFD", () => {
    expect(toPatchBody(same, device)).toEqual({ kind: "unchanged" });
    expect(toPatchBody({ ...same, name: " Desk PC " }, device)).toEqual({ kind: "unchanged" });
    const viet = { ...device, name: "Máy" };
    expect(toPatchBody({ ...formFromDevice(viet), name: "Máy" }, viet)).toEqual({
      kind: "unchanged",
    });
  });
  it("MAC retyped in another form is unchanged; null stays unchanged when blank", () => {
    expect(toPatchBody({ ...same, mac: "AA-BB-CC-DD-EE-FF" }, device)).toEqual({
      kind: "unchanged",
    });
    const none = { ...device, mac: null };
    expect(toPatchBody(formFromDevice(none), none)).toEqual({ kind: "unchanged" });
  });
  it("blank MAC clears to null; invalid MAC and blank name are invalid", () => {
    expect(toPatchBody({ ...same, mac: "" }, device)).toEqual({ kind: "ok", body: { mac: null } });
    expect(toPatchBody({ ...same, mac: "nope" }, device)).toEqual({
      kind: "invalid",
      message: fe.mac,
    });
    expect(toPatchBody({ ...same, name: " " }, device)).toEqual({
      kind: "invalid",
      message: fe.name,
    });
  });
  it("serial, manufacturer and brand: only changes are sent", () => {
    expect(toPatchBody({ ...same, serial: "SN-9" }, device)).toEqual({
      kind: "ok",
      body: { serial: "SN-9" },
    });
    const withSerial = { ...device, serial: "SN-9", manufacturer: "Dell" };
    expect(toPatchBody({ ...formFromDevice(withSerial), serial: "" }, withSerial)).toEqual({
      kind: "ok",
      body: { serial: null },
    });
    expect(toPatchBody({ ...formFromDevice(withSerial), serial: " SN-9 " }, withSerial)).toEqual({
      kind: "unchanged",
    });
    const viet = { ...device, brand: "Máy" };
    expect(toPatchBody({ ...formFromDevice(viet), brand: "Máy" }, viet)).toEqual({
      kind: "unchanged",
    });
    expect(toPatchBody({ ...same, serial: "a".repeat(101) }, device)).toEqual({
      kind: "invalid",
      message: fe.serial,
    });
  });
  it("patch never has ownerId", () => {
    const r = toPatchBody(filled({ name: "x", type: "y", inventoryNumber: "z" }), device);
    if (r.kind !== "ok") throw new Error("expected ok");
    for (const k of Object.keys(r.body)) {
      expect(["name", "type", "inventoryNumber", "mac"]).toContain(k);
    }
  });
});

describe("deviceErrorMessage", () => {
  it("passes API codes through", () => {
    for (const c of [
      "inventory_number_taken",
      "mac_taken",
      "serial_taken",
      "no_linked_member",
      "not_allowed",
    ]) {
      expect(deviceErrorMessage(c)).toBe(apiErrorMessage(c));
    }
    expect(deviceErrorMessage("serial_taken")).toBe(apiCopy.errors.serial_taken);
    expect(deviceErrorMessage("zzz")).toBe(apiErrorMessage("zzz"));
  });
});

describe("filterAfterCreate", () => {
  it("placed becomes all; others stay", () => {
    expect(filterAfterCreate("placed")).toBe("all");
    expect(filterAfterCreate("all")).toBe("all");
    expect(filterAfterCreate("inventory")).toBe("inventory");
    expect(filterAfterCreate("unowned")).toBe("unowned");
  });
});
