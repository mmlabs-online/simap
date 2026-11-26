import { describe, expect, it } from "vitest";
import { avatarFor, HAIR_RAMP, SHIRT_RAMP, SKIN_RAMP } from "@/lib/sprites/avatar";
import { derivedChoice, lookFromChoice, resolveLook } from "@/lib/sprites/pixel-look";
import { apiErrorMessage } from "../copy/api";
import { portalCopy } from "../copy/portal";
import {
  afterReset,
  afterSave,
  canReset,
  canSave,
  choose,
  initialPicker,
  isDerived,
  loaded,
  pickerErrorMessage,
  pickerOptions,
  startBusy,
} from "./pixel-look-state";

const copy = portalCopy.profile.character;
const ID = "3f2a9c1e-5b7d-4e8a-9c0f-1a2b3c4d5e6f";
const stored = { skin: 0, hair: 1, style: 2 as const, shirt: 3 };
const ready = (look: typeof stored | null = null) =>
  loaded(initialPicker(ID), { ok: true, value: look });
const otherStyle = ((derivedChoice(ID).style % 3) + 1) as 1 | 2 | 3;

describe("pixel look state", () => {
  it("pickerOptions: exactly SKIN_RAMP, HAIR_RAMP, SHIRT_RAMP entries (index + hex) and styles 1..3", () => {
    const o = pickerOptions();
    expect(o.skin).toEqual(SKIN_RAMP.map((hex, index) => ({ index, hex })));
    expect(o.hair).toEqual(HAIR_RAMP.map((hex, index) => ({ index, hex })));
    expect(o.shirt).toEqual(SHIRT_RAMP.map((hex, index) => ({ index, hex })));
    expect(o.style).toEqual([1, 2, 3]);
  });

  it("initialPicker: loading, draft = derivedChoice(memberId), saved null", () => {
    expect(initialPicker(ID)).toMatchObject({
      status: "loading",
      draft: derivedChoice(ID),
      saved: null,
      busy: null,
      notice: null,
    });
  });

  it("loaded ok with a look: ready, saved and draft = look; ok null: draft = derived, isDerived true; failure: status failed, draft derived, loadFailed notice", () => {
    expect(ready(stored)).toMatchObject({ status: "ready", saved: stored, draft: stored });
    const b = ready();
    expect(b).toMatchObject({ status: "ready", saved: null, draft: derivedChoice(ID) });
    expect(isDerived(b)).toBe(true);
    const c = loaded(initialPicker(ID), { ok: false, code: "unavailable" });
    expect(c).toMatchObject({
      status: "failed",
      draft: derivedChoice(ID),
      notice: { tone: "error", text: copy.loadFailed },
    });
  });

  it("choose sets one layer and clears the notice; choose ignores an index outside its ramp, a style outside 1..3, and calls while busy", () => {
    const s = { ...ready(), notice: { tone: "error" as const, text: "x" } };
    const n = choose(s, "skin", 2);
    expect(n.draft.skin).toBe(2);
    expect(n.notice).toBeNull();
    expect(choose(s, "skin", -1)).toBe(s);
    expect(choose(s, "skin", SKIN_RAMP.length)).toBe(s);
    expect(choose(s, "hair", HAIR_RAMP.length)).toBe(s);
    expect(choose(s, "shirt", SHIRT_RAMP.length)).toBe(s);
    expect(choose(s, "style", 0)).toBe(s);
    expect(choose(s, "style", 4)).toBe(s);
    const busy = startBusy(s, "save");
    expect(choose(busy, "skin", 1)).toBe(busy);
  });

  it("canSave: false while loading or busy, false when draft equals saved, false when nothing saved and draft equals derived, true after a change", () => {
    expect(canSave(initialPicker(ID))).toBe(false);
    expect(canSave(startBusy(choose(ready(), "style", otherStyle), "save"))).toBe(false);
    expect(canSave(ready(stored))).toBe(false);
    expect(canSave(ready())).toBe(false);
    expect(canSave(choose(ready(stored), "skin", 3))).toBe(true);
    expect(canSave(choose(ready(), "style", otherStyle))).toBe(true);
  });

  it("canReset: false while loading or busy, false when nothing saved and draft equals derived, true when a look is saved or the draft changed", () => {
    expect(canReset(initialPicker(ID))).toBe(false);
    expect(canReset(startBusy(ready(stored), "reset"))).toBe(false);
    expect(canReset(ready())).toBe(false);
    expect(canReset(ready(stored))).toBe(true);
    expect(canReset(choose(ready(), "style", otherStyle))).toBe(true);
  });

  it("afterSave ok: saved = draft = server look, status notice saved; failure: draft kept, error notice", () => {
    const s = startBusy(choose(ready(), "style", otherStyle), "save");
    expect(afterSave(s, { ok: true, value: stored })).toMatchObject({
      busy: null,
      saved: stored,
      draft: stored,
      notice: { tone: "status", text: copy.saved },
    });
    expect(afterSave(s, { ok: false, code: "invalid_look" })).toMatchObject({
      busy: null,
      saved: null,
      draft: s.draft,
      notice: { tone: "error", text: copy.errors.invalidLook },
    });
  });

  it("afterReset ok: saved null, draft = derivedChoice(memberId), lookFromChoice(draft) equals resolveLook(null, memberId) and avatarFor(memberId), notice resetDone", () => {
    const out = afterReset(startBusy(ready(stored), "reset"), { ok: true, value: null });
    expect(out).toMatchObject({
      busy: null,
      saved: null,
      draft: derivedChoice(ID),
      notice: { tone: "status", text: copy.resetDone },
    });
    expect(lookFromChoice(out.draft)).toEqual(resolveLook(null, ID));
    expect(lookFromChoice(out.draft)).toEqual(avatarFor(ID));
  });

  it("afterReset failure: saved and draft unchanged, error notice", () => {
    const s = startBusy(choose(ready(stored), "skin", 3), "reset");
    expect(afterReset(s, { ok: false, code: "unavailable" })).toMatchObject({
      busy: null,
      saved: stored,
      draft: s.draft,
      notice: { tone: "error", text: copy.errors.retry },
    });
  });

  it("pickerErrorMessage: invalid_look and invalid_request use character.errors.invalidLook; unavailable uses character.errors.retry; member_deactivated, not_found and unknown codes use apiErrorMessage", () => {
    expect(pickerErrorMessage("invalid_look")).toBe(copy.errors.invalidLook);
    expect(pickerErrorMessage("invalid_request")).toBe(copy.errors.invalidLook);
    expect(pickerErrorMessage("unavailable")).toBe(copy.errors.retry);
    for (const c of ["member_deactivated", "not_found", "nope"]) {
      expect(pickerErrorMessage(c)).toBe(apiErrorMessage(c));
    }
  });
});
