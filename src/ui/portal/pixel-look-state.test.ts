import { describe, expect, it } from "vitest";
import { avatarFor, HAIR_RAMP, SHIRT_RAMP, SKIN_RAMP } from "@/lib/sprites/avatar";
import { derivedChoice, lookFromChoice, resolveLook } from "@/lib/sprites/pixel-look";
import { apiErrorMessage } from "../copy/api";
import { portalCopy } from "../copy/portal";
import {
  afterReset,
  afterSave,
  canReset,
  choose,
  discard,
  initialPicker,
  isDerived,
  loaded,
  lookDirty,
  lookSaveAction,
  pickerErrorMessage,
  pickerOptions,
  resetDraft,
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

  it("lookDirty: false after load (stored or derived); true after choose; false after choosing back; true after resetDraft with a stored look; false after resetDraft with none stored", () => {
    expect(lookDirty(ready(stored))).toBe(false);
    expect(lookDirty(ready())).toBe(false);
    const changed = choose(ready(), "style", otherStyle);
    expect(lookDirty(changed)).toBe(true);
    expect(lookDirty(choose(changed, "style", derivedChoice(ID).style))).toBe(false);
    expect(lookDirty(resetDraft(ready(stored)))).toBe(true);
    expect(lookDirty(resetDraft(ready()))).toBe(false);
  });

  it('lookSaveAction: null when clean; "save" for a changed draft; "reset" when a look is stored and draft equals derived', () => {
    expect(lookSaveAction(ready(stored))).toBeNull();
    expect(lookSaveAction(ready())).toBeNull();
    expect(lookSaveAction(choose(ready(stored), "skin", 3))).toBe("save");
    expect(lookSaveAction(choose(ready(), "style", otherStyle))).toBe("save");
    expect(lookSaveAction(resetDraft(ready(stored)))).toBe("reset");
  });

  it("resetDraft sets draft = derivedChoice(memberId) without touching saved; ignored while busy", () => {
    const out = resetDraft(ready(stored));
    expect(out.draft).toEqual(derivedChoice(ID));
    expect(out.saved).toEqual(stored);
    const busy = startBusy(ready(stored), "save");
    expect(resetDraft(busy)).toBe(busy);
  });

  it("discard sets draft = saved ?? derived and clears notice; ignored while busy", () => {
    const withNotice = (s: ReturnType<typeof ready>) => ({
      ...choose(s, "skin", 3),
      notice: { tone: "error" as const, text: "x" },
    });
    expect(discard(withNotice(ready(stored)))).toMatchObject({ draft: stored, notice: null });
    expect(discard(withNotice(ready()))).toMatchObject({ draft: derivedChoice(ID), notice: null });
    const busy = startBusy(ready(stored), "save");
    expect(discard(busy)).toBe(busy);
  });

  it("canReset: false while loading or busy, false when draft equals derived, true otherwise", () => {
    expect(canReset(initialPicker(ID))).toBe(false);
    expect(canReset(startBusy(ready(stored), "reset"))).toBe(false);
    expect(canReset(ready())).toBe(false);
    expect(canReset(ready(stored))).toBe(true);
    expect(canReset(choose(ready(), "style", otherStyle))).toBe(true);
    expect(canReset(resetDraft(ready(stored)))).toBe(false);
  });

  it("afterSave and afterReset success leave notice null; failures keep draft and set the error notice", () => {
    const s = startBusy(choose(ready(), "style", otherStyle), "save");
    expect(afterSave(s, { ok: true, value: stored })).toMatchObject({
      busy: null,
      saved: stored,
      draft: stored,
      notice: null,
    });
    expect(afterSave(s, { ok: false, code: "invalid_look" })).toMatchObject({
      busy: null,
      saved: null,
      draft: s.draft,
      notice: { tone: "error", text: copy.errors.invalidLook },
    });
    const out = afterReset(startBusy(ready(stored), "reset"), { ok: true, value: null });
    expect(out).toMatchObject({ busy: null, saved: null, draft: derivedChoice(ID), notice: null });
    expect(lookFromChoice(out.draft)).toEqual(resolveLook(null, ID));
    expect(lookFromChoice(out.draft)).toEqual(avatarFor(ID));
    const f = startBusy(choose(ready(stored), "skin", 3), "reset");
    expect(afterReset(f, { ok: false, code: "unavailable" })).toMatchObject({
      busy: null,
      saved: stored,
      draft: f.draft,
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
