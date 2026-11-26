import { HAIR_RAMP, SHIRT_RAMP, SKIN_RAMP } from "@/lib/sprites/avatar";
import {
  derivedChoice,
  isPixelLook,
  PIXEL_LOOK_KEYS,
  type PixelLook,
} from "@/lib/sprites/pixel-look";
import { apiErrorMessage } from "../copy/api";
import { portalCopy } from "../copy/portal";
import type { PixelLookResult } from "./pixel-look-api";

const copy = portalCopy.profile.character;

export type PixelLookKey = (typeof PIXEL_LOOK_KEYS)[number];
export type PickerNotice = { tone: "status" | "error"; text: string };
export type PickerState = {
  memberId: string;
  status: "loading" | "ready" | "failed";
  saved: PixelLook | null;
  draft: PixelLook;
  busy: "save" | "reset" | null;
  notice: PickerNotice | null;
};

const swatches = (ramp: readonly string[]) => ramp.map((hex, index) => ({ index, hex }));

/** The offered presets, from the avatar ramps (append-only), never hard-coded counts. */
export function pickerOptions() {
  return {
    skin: swatches(SKIN_RAMP),
    hair: swatches(HAIR_RAMP),
    style: [1, 2, 3] as (1 | 2 | 3)[],
    shirt: swatches(SHIRT_RAMP),
  };
}

export const sameLook = (a: PixelLook, b: PixelLook) => PIXEL_LOOK_KEYS.every((k) => a[k] === b[k]);

export const isDerived = (s: PickerState) =>
  s.saved === null && sameLook(s.draft, derivedChoice(s.memberId));

export const initialPicker = (memberId: string): PickerState => ({
  memberId,
  status: "loading",
  saved: null,
  draft: derivedChoice(memberId),
  busy: null,
  notice: null,
});

/** The first GET: a stored look, none stored (derived), or a failure (derived, with a notice). */
export function loaded(s: PickerState, r: PixelLookResult<PixelLook | null>): PickerState {
  if (!r.ok) {
    return { ...s, status: "failed", notice: { tone: "error", text: copy.loadFailed } };
  }
  return {
    ...s,
    status: "ready",
    saved: r.value,
    draft: r.value ?? derivedChoice(s.memberId),
  };
}

/** Sets one layer; ignores a value outside its ramp, and any call while a request runs. */
export function choose(s: PickerState, key: PixelLookKey, value: number): PickerState {
  if (s.busy !== null) return s;
  const next = { ...s.draft, [key]: value };
  return isPixelLook(next) ? { ...s, draft: next, notice: null } : s;
}

export const startBusy = (s: PickerState, busy: "save" | "reset"): PickerState => ({
  ...s,
  busy,
  notice: null,
});

export function pickerErrorMessage(code: string): string {
  if (code === "invalid_look" || code === "invalid_request") return copy.errors.invalidLook;
  if (code === "unavailable") return copy.errors.retry;
  return apiErrorMessage(code);
}

const failed = (s: PickerState, code: string): PickerState => ({
  ...s,
  busy: null,
  notice: { tone: "error", text: pickerErrorMessage(code) },
});

export function afterSave(s: PickerState, r: PixelLookResult<PixelLook>): PickerState {
  if (!r.ok) return failed(s, r.code);
  return {
    ...s,
    busy: null,
    saved: r.value,
    draft: r.value,
    notice: null,
  };
}

export function afterReset(s: PickerState, r: PixelLookResult<null>): PickerState {
  if (!r.ok) return failed(s, r.code);
  return {
    ...s,
    busy: null,
    saved: null,
    draft: derivedChoice(s.memberId),
    notice: null,
  };
}

const idle = (s: PickerState) => s.busy === null && s.status !== "loading";

/** The draft differs from what is stored, or from the derived look when nothing is stored. */
export const lookDirty = (s: PickerState) =>
  !sameLook(s.draft, s.saved ?? derivedChoice(s.memberId));

/** What the footer Save must send: nothing, a PUT, or a DELETE (a stored look and a derived draft). */
export function lookSaveAction(s: PickerState): "save" | "reset" | null {
  if (!lookDirty(s)) return null;
  return s.saved !== null && sameLook(s.draft, derivedChoice(s.memberId)) ? "reset" : "save";
}

/** Reset is a draft action: the draft goes back to the derived look, nothing is sent until Save. */
export const resetDraft = (s: PickerState): PickerState =>
  s.busy !== null ? s : { ...s, draft: derivedChoice(s.memberId), notice: null };

/** Cancel: the draft goes back to the stored look (or the derived one). */
export const discard = (s: PickerState): PickerState =>
  s.busy !== null ? s : { ...s, draft: s.saved ?? derivedChoice(s.memberId), notice: null };

export const canReset = (s: PickerState) =>
  idle(s) && !sameLook(s.draft, derivedChoice(s.memberId));
