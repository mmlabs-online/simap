import type { DeviceTypeDto } from "@/lib/device-types/types";
import { apiErrorMessage } from "../copy/api";
import { deviceTypesCopy } from "../copy/deviceTypes";
import { toCreateBody, toPatchBody, type DeviceTypeForm } from "./device-type-form";
import type { ImageDraft } from "./device-type-image";
import type { DeviceTypesApi } from "./device-types-api";

export type SaveResult =
  | { kind: "invalid"; message: string }
  | { kind: "closed" }
  | { kind: "done" }
  | { kind: "failed"; message: string }
  | { kind: "imageFailed"; saved: DeviceTypeDto; message: string };

/** Type step first (POST or PATCH), then the image step (PUT or DELETE). `not_found` on either step counts as done. */
export async function saveDeviceType(args: {
  api: DeviceTypesApi;
  current: DeviceTypeDto | null;
  form: DeviceTypeForm;
  draft: ImageDraft;
}): Promise<SaveResult> {
  const { api, current, form, draft } = args;
  let saved: DeviceTypeDto;
  if (!current) {
    const create = toCreateBody(form);
    if (create.kind === "invalid") return { kind: "invalid", message: create.message };
    const r = await api.create(create.body);
    if (!r.ok) {
      return r.code === "not_found"
        ? { kind: "done" }
        : { kind: "failed", message: apiErrorMessage(r.code) };
    }
    saved = r.value;
  } else {
    const patch = toPatchBody(form, current);
    if (patch.kind === "invalid") return { kind: "invalid", message: patch.message };
    if (patch.kind === "unchanged") {
      if (draft.kind === "keep") return { kind: "closed" };
      saved = current;
    } else {
      const r = await api.update(current.id, patch.body);
      if (!r.ok) {
        return r.code === "not_found"
          ? { kind: "done" }
          : { kind: "failed", message: apiErrorMessage(r.code) };
      }
      saved = r.value;
    }
  }
  if (draft.kind === "keep") return { kind: "done" };
  const r =
    draft.kind === "replace"
      ? await api.putImage(saved.id, draft.bytes)
      : await api.removeImage(saved.id);
  if (r.ok || r.code === "not_found") return { kind: "done" };
  return {
    kind: "imageFailed",
    saved,
    message: deviceTypesCopy.form.imageSaveFailed + apiErrorMessage(r.code),
  };
}
