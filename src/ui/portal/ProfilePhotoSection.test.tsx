import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { portalCopy } from "../copy/portal";
import { ProfilePhotoSection, type ProfilePhotoSectionProps } from "./ProfilePhotoSection";

const copy = portalCopy.profile.photo;
const render = (p: Partial<ProfilePhotoSectionProps> = {}) =>
  renderToStaticMarkup(
    <ProfilePhotoSection
      name="Nguyễn Thị Ánh"
      url={null}
      status="ready"
      busy={null}
      error={null}
      notice={null}
      onPick={() => {}}
      onRemove={() => {}}
      {...p}
    />,
  );

describe("ProfilePhotoSection", () => {
  it("no photo: initials, 'Upload photo', no remove button", () => {
    const html = render();
    expect(html).toContain("NÁ");
    expect(html).toContain(copy.upload);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<button");
  });

  it("photo: img with the blob URL, 'Replace photo' and 'Remove photo'", () => {
    const html = render({ url: "blob:abc" });
    expect(html).toContain('src="blob:abc"');
    expect(html).toContain(copy.replace);
    expect(html).toContain(copy.remove);
  });

  it("busy disables the file input and the remove button and shows the busy label", () => {
    const html = render({ url: "blob:abc", busy: "upload" });
    expect(html).toMatch(/<input[^>]*disabled/);
    expect(html).toMatch(/<button[^>]*disabled/);
    expect(html).toContain(copy.uploading);
    expect(render({ url: "blob:abc", busy: "remove" })).toContain(copy.removing);
  });

  it("processing shows the processing label and disables the input and the remove button", () => {
    const html = render({ url: "blob:abc", busy: "processing" });
    expect(html).toContain(copy.processing);
    expect(html).toMatch(/<input[^>]*disabled/);
    expect(html).toMatch(/<button[^>]*disabled/);
  });

  it("error renders role=alert, notice renders role=status", () => {
    expect(render({ error: "bad" })).toContain('role="alert"');
    expect(render({ notice: "ok" })).toContain('role="status"');
  });

  it("file input accepts image/* and sits inside its label; the hint is shown", () => {
    const html = render();
    expect(html).toMatch(
      /<label[^>]*>(?:<span[^>]*>[^<]*<\/span>)?[^<]*<input[^>]*accept="image\/\*"/,
    );
    expect(html).toContain(copy.hint);
  });

  it("status failed shows loadFailed and still offers upload", () => {
    const html = render({ status: "failed" });
    expect(html).toContain(copy.loadFailed);
    expect(html).toContain(copy.upload);
  });
});
