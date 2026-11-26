import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { portalCopy } from "../copy/portal";
import { ProfileTabView, type ProfileTabViewProps } from "./ProfileTabView";

const render = (p: Partial<ProfileTabViewProps> = {}) =>
  renderToStaticMarkup(
    <ProfileTabView
      initialName="Nguyễn Thị Ánh"
      email="anh@example.com"
      tier="manager"
      saving={false}
      notice={null}
      onSubmit={() => {}}
      {...p}
    />,
  );

describe("ProfileTabView", () => {
  it("shows email and role read-only with 'Managed in mmlabs'; no autofocus", () => {
    const html = render();
    expect(html).toContain("anh@example.com");
    expect(html).toContain("Manager");
    expect(html).toContain(portalCopy.profile.managed);
    expect(html).toContain("Nguyễn Thị Ánh");
    expect(html).not.toMatch(/autofocus/i);
  });
  it("a refused name shows the invalid error with aria-invalid", () => {
    const html = render({ error: "invalid" });
    expect(html).toContain(portalCopy.profile.errors.invalid);
    expect(html).toContain('aria-invalid="true"');
  });
  it("saving disables the button", () => {
    const html = render({ saving: true });
    expect(html).toMatch(/<button[^>]*disabled[^>]*>/);
    expect(html).toContain(portalCopy.profile.saving);
  });
  it("sections slot renders between the heading and the name form; absent when not given", () => {
    const html = render({ sections: <p>slot-marker</p> });
    const h = html.indexOf(portalCopy.profile.heading);
    const s = html.indexOf("slot-marker");
    const f = html.indexOf("<form");
    expect(h).toBeGreaterThanOrEqual(0);
    expect(s).toBeGreaterThan(h);
    expect(f).toBeGreaterThan(s);
    expect(render()).not.toContain("slot-marker");
  });
  it("notice renders with role status", () => {
    expect(render({ notice: { tone: "status", text: portalCopy.profile.saved } })).toContain(
      'role="status"',
    );
  });
});
