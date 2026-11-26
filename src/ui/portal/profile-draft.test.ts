import { describe, expect, it } from "vitest";
import { portalCopy } from "../copy/portal";
import { footerStatus, nameDirty, nameLength } from "./profile-draft";

const copy = portalCopy.profile.footer;

describe("profile draft helpers", () => {
  it('nameLength counts NFC code points ("Ánh" NFD → 3; "Nguyễn Thị Ánh" → 14; emoji → 1)', () => {
    expect(nameLength("Ánh")).toBe(3);
    expect(nameLength("Nguyễn Thị Ánh")).toBe(14);
    expect(nameLength("Nguyễn Thị Ánh")).toBe(14);
    expect(nameLength("😀")).toBe(1);
    expect(nameLength("")).toBe(0);
  });

  it("nameDirty: equal → false; any difference (including whitespace) → true", () => {
    expect(nameDirty("Anh", "Anh")).toBe(false);
    expect(nameDirty("Anh ", "Anh")).toBe(true);
    expect(nameDirty("anh", "Anh")).toBe(true);
  });

  it('footerStatus: busy → saving; errors → error with all texts; dirty → unsaved; clean → saved with detail "Saved to your account"; busy wins over errors', () => {
    expect(footerStatus({ busy: true, dirty: true, errors: ["x"] })).toEqual({
      tone: "busy",
      text: copy.saving,
    });
    const err = footerStatus({ busy: false, dirty: true, errors: ["a.", "b."] });
    expect(err.tone).toBe("error");
    expect(err.text).toContain("a.");
    expect(err.text).toContain("b.");
    expect(footerStatus({ busy: false, dirty: true, errors: [] })).toEqual({
      tone: "dirty",
      text: copy.dirty,
    });
    expect(footerStatus({ busy: false, dirty: false, errors: [] })).toEqual({
      tone: "saved",
      text: copy.saved,
      detail: "Saved to your account",
    });
  });
});
