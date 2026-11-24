import { describe, expect, it } from "vitest";
import type { DeviceDto } from "@/lib/devices/types";
import { apiErrorMessage } from "../copy/api";
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
const member = { id: UUID, displayName: "Ha", employeeCode: null };
const fe = devicesCopy.form.fieldErrors;
const filled = (over: Partial<DeviceForm> = {}): DeviceForm => ({
  name: "Desk PC",
  type: "PC",
  inventoryNumber: "INV-1",
  mac: "",
  owner: { kind: "me" },
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
};
const body = (r: ReturnType<typeof toCreateBody>) => {
  if (r.kind !== "ok") throw new Error("expected ok");
  return r.body;
};

describe("form setup", () => {
  it("emptyForm and formFromDevice", () => {
    expect(emptyForm()).toMatchObject({ name: "", mac: "", owner: { kind: "me" } });
    expect(formFromDevice({ ...device, mac: null }).mac).toBe("");
    expect(formFromDevice(device)).toMatchObject({ mac: device.mac, owner: { kind: "me" } });
  });
});

describe("toCreateBody", () => {
  it("create for self sends no ownerId", () => {
    for (const isAdmin of [false, true]) {
      expect("ownerId" in body(toCreateBody(filled(), { isAdmin }))).toBe(false);
    }
  });
  it("Admin for a member sends ownerId", () => {
    const r = toCreateBody(filled({ owner: { kind: "member", member } }), { isAdmin: true });
    expect(body(r).ownerId).toBe(UUID);
  });
  it("non-Admin never sends ownerId", () => {
    const r = toCreateBody(filled({ owner: { kind: "member", member } }), { isAdmin: false });
    expect("ownerId" in body(r)).toBe(false);
  });
  it("member kind without a pick is invalid", () => {
    expect(
      toCreateBody(filled({ owner: { kind: "member", member: null } }), { isAdmin: true }),
    ).toEqual({ kind: "invalid", message: fe.ownerId });
  });
  it("normalises the MAC; blank is null; garbage is invalid", () => {
    const mac = (m: string) => toCreateBody(filled({ mac: m }), { isAdmin: false });
    expect(body(mac("AA-BB-CC-DD-EE-FF")).mac).toBe("aa:bb:cc:dd:ee:ff");
    expect(body(mac("aabb.ccdd.eeff")).mac).toBe("aa:bb:cc:dd:ee:ff");
    expect(body(mac("AABBCCDDEEFF")).mac).toBe("aa:bb:cc:dd:ee:ff");
    expect(body(mac("  ")).mac).toBeNull();
    expect(mac("zz:bb:cc:dd:ee:ff")).toEqual({ kind: "invalid", message: fe.mac });
  });
  it("field messages, length limit and NFC trimming", () => {
    const run = (over: Partial<DeviceForm>) => toCreateBody(filled(over), { isAdmin: false });
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
  it("patch never has ownerId", () => {
    const r = toPatchBody(
      { name: "x", type: "y", inventoryNumber: "z", mac: "", owner: { kind: "member", member } },
      device,
    );
    if (r.kind !== "ok") throw new Error("expected ok");
    for (const k of Object.keys(r.body)) {
      expect(["name", "type", "inventoryNumber", "mac"]).toContain(k);
    }
  });
});

describe("deviceErrorMessage", () => {
  it("maps device codes, passes shared ones through", () => {
    expect(deviceErrorMessage("member_not_assignable")).toBe(
      devicesCopy.form.errors.memberNotAssignable,
    );
    for (const c of ["inventory_number_taken", "mac_taken", "no_linked_member", "not_allowed"]) {
      expect(deviceErrorMessage(c)).toBe(apiErrorMessage(c));
    }
    expect(deviceErrorMessage("zzz")).toBe(apiErrorMessage("zzz"));
  });
});

describe("filterAfterCreate", () => {
  it("placed becomes all; others stay", () => {
    expect(filterAfterCreate("placed")).toBe("all");
    expect(filterAfterCreate("all")).toBe("all");
    expect(filterAfterCreate("inventory")).toBe("inventory");
  });
});
