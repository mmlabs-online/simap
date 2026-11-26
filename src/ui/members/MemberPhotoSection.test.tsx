import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { membersCopy } from "../copy/members";
import { MemberPhotoSection } from "./MemberPhotoSection";

const api = { removePhoto: async () => ({ ok: true as const, value: null }) };
const render = (hasPhoto: boolean, photoUrl: string | null, name = "Nguyễn Văn Ân") =>
  renderToStaticMarkup(
    <MemberPhotoSection
      member={{ id: "m1", displayName: name, hasPhoto }}
      photoUrl={photoUrl}
      api={api}
      onRemoved={() => {}}
    />,
  );

describe("MemberPhotoSection", () => {
  it("shows the photo img (alt empty) when photoUrl is set; initials when null", () => {
    const html = render(true, "blob:p1");
    expect(html).toContain('src="blob:p1"');
    expect(html).toContain('alt=""');
    const none = render(true, null);
    expect(none).not.toContain("<img");
  });

  it("Remove photo button only when hasPhoto; aria-label names the member (Vietnamese diacritics kept)", () => {
    const withPhoto = render(true, "blob:p1");
    expect(withPhoto).toContain(`>${membersCopy.photo.remove}<`);
    expect(withPhoto).toContain(`aria-label="${membersCopy.photo.removeLabel("Nguyễn Văn Ân")}"`);
    const without = render(false, null);
    expect(without).not.toContain(membersCopy.photo.remove);
  });
});
