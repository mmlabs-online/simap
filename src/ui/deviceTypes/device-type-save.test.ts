import { describe, expect, it, vi } from "vitest";
import type { DeviceTypeDto } from "@/lib/device-types/types";
import { apiErrorMessage } from "../copy/api";
import { deviceTypesCopy } from "../copy/deviceTypes";
import { saveDeviceType } from "./device-type-save";
import type { ImageDraft } from "./device-type-image";
import type { DeviceTypesApi, DeviceTypesResult } from "./device-types-api";

const dto = (over: Partial<DeviceTypeDto> = {}): DeviceTypeDto => ({
  id: "t1",
  name: "Printer",
  slot: "pc",
  hasImage: false,
  imageVersion: 0,
  sprite: null,
  ...over,
});
const ok = <T>(value: T): DeviceTypesResult<T> => ({ ok: true, value });
const bad = (code: string) => ({ ok: false as const, code });

function fakeApi(over: Partial<Record<string, unknown>> = {}) {
  const api = {
    create: vi.fn(async () => ok(dto())),
    update: vi.fn(async () => ok(dto({ name: "New" }))),
    putImage: vi.fn(async () => ok(dto({ hasImage: true, imageVersion: 1 }))),
    removeImage: vi.fn(async () => ok(null)),
    ...over,
  };
  return { api: api as unknown as DeviceTypesApi, m: api };
}
const keep: ImageDraft = { kind: "keep" };
const replace: ImageDraft = { kind: "replace", bytes: new Uint8Array([1]), url: "blob:x" };
const remove: ImageDraft = { kind: "remove" };
const form = { name: "Printer", slot: "pc", sprite: null } as const;

describe("saveDeviceType", () => {
  it("create + keep: POST only, done", async () => {
    const { api, m } = fakeApi();
    expect(await saveDeviceType({ api, current: null, form, draft: keep })).toEqual({
      kind: "done",
    });
    expect(m.create).toHaveBeenCalledTimes(1);
    expect(m.putImage).not.toHaveBeenCalled();
  });
  it("create + replace: POST then PUT with the created id, done", async () => {
    const { api, m } = fakeApi();
    expect(await saveDeviceType({ api, current: null, form, draft: replace })).toEqual({
      kind: "done",
    });
    expect(m.putImage).toHaveBeenCalledWith("t1", replace.kind === "replace" && replace.bytes);
  });
  it.each([
    "image_not_png",
    "image_bad_size",
    "image_too_large",
    "images_unavailable",
    "drive_error",
    "image_changed",
  ])("create ok then PUT refused %s: imageFailed with the created DTO", async (code) => {
    const { api } = fakeApi({ putImage: vi.fn(async () => bad(code)) });
    expect(await saveDeviceType({ api, current: null, form, draft: replace })).toEqual({
      kind: "imageFailed",
      saved: dto(),
      message: deviceTypesCopy.form.imageSaveFailed + apiErrorMessage(code),
    });
  });
  it("edit, fields unchanged + keep: closed, no calls", async () => {
    const { api, m } = fakeApi();
    expect(await saveDeviceType({ api, current: dto(), form, draft: keep })).toEqual({
      kind: "closed",
    });
    expect(m.update).not.toHaveBeenCalled();
  });
  it("edit, fields unchanged + replace: no PATCH, PUT only", async () => {
    const { api, m } = fakeApi();
    expect(await saveDeviceType({ api, current: dto(), form, draft: replace })).toEqual({
      kind: "done",
    });
    expect(m.update).not.toHaveBeenCalled();
    expect(m.putImage).toHaveBeenCalledTimes(1);
  });
  it("edit, fields changed + remove: PATCH then DELETE", async () => {
    const { api, m } = fakeApi();
    const r = await saveDeviceType({
      api,
      current: dto(),
      form: { ...form, name: "New" },
      draft: remove,
    });
    expect(r).toEqual({ kind: "done" });
    expect(m.update).toHaveBeenCalledTimes(1);
    expect(m.removeImage).toHaveBeenCalledWith("t1");
  });
  it("type step refused: failed, no image call", async () => {
    const { api, m } = fakeApi({ create: vi.fn(async () => bad("name_taken")) });
    expect(await saveDeviceType({ api, current: null, form, draft: replace })).toEqual({
      kind: "failed",
      message: apiErrorMessage("name_taken"),
    });
    expect(m.putImage).not.toHaveBeenCalled();
  });
  it("type step not_found: done; image step not_found: done", async () => {
    const a = fakeApi({ update: vi.fn(async () => bad("not_found")) });
    expect(
      await saveDeviceType({
        api: a.api,
        current: dto(),
        form: { ...form, name: "N" },
        draft: keep,
      }),
    ).toEqual({ kind: "done" });
    const b = fakeApi({ putImage: vi.fn(async () => bad("not_found")) });
    expect(await saveDeviceType({ api: b.api, current: dto(), form, draft: replace })).toEqual({
      kind: "done",
    });
  });
  it("invalid form: invalid, no calls", async () => {
    const { api, m } = fakeApi();
    const r = await saveDeviceType({
      api,
      current: null,
      form: { name: "", slot: "pc", sprite: null },
      draft: replace,
    });
    expect(r.kind).toBe("invalid");
    expect(m.create).not.toHaveBeenCalled();
  });
});
