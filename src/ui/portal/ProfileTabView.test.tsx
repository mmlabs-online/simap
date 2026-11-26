import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TIERS } from "@/lib/tier";
import { DISPLAY_NAME_MAX } from "@/lib/validate/member";
import { portalCopy } from "../copy/portal";
import { shellCopy } from "../copy/shell";
import { ProfileTabView, type ProfileTabViewProps } from "./ProfileTabView";

const copy = portalCopy.profile;
const base: ProfileTabViewProps = {
  name: "Nguyễn Thị Ánh",
  email: "anh@example.com",
  tier: "manager",
  orgName: "Acme Labs",
  nameError: null,
  onNameChange: () => {},
  busy: false,
  photo: <p>photo-marker</p>,
  character: <p>character-marker</p>,
  footer: {
    status: { tone: "saved", text: copy.footer.saved, detail: copy.footer.savedDetail },
    canSave: false,
    canCancel: false,
  },
  onCancel: () => {},
};
const render = (p: Partial<ProfileTabViewProps> = {}) =>
  renderToStaticMarkup(<ProfileTabView {...base} {...p} />);
const tag = (html: string, id: string) => html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))![0];

describe("ProfileTabView", () => {
  it("renders the header and the three cards in order inside a 1-col / lg:2-col grid", () => {
    const html = render();
    expect(html).toContain("grid-cols-1");
    expect(html).toContain("lg:grid-cols-2");
    const order = [
      copy.title,
      copy.personal.title,
      copy.membership.title,
      "character-marker",
      copy.footer.save,
    ].map((t) => html.indexOf(t));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(html).toContain(copy.visibility);
    expect(html).not.toMatch(/autofocus/i);
  });

  it("counter shows nameLength/DISPLAY_NAME_MAX and is in aria-describedby; required marker aria-hidden; input required and maxLength", () => {
    const html = render();
    expect(html).toContain(`>${copy.counter(14, DISPLAY_NAME_MAX)}<`);
    const input = tag(html, "portal-name");
    expect(input).toContain("portal-name-count");
    expect(input).toContain("required");
    expect(input).toContain(`maxLength="${DISPLAY_NAME_MAX}"`);
    expect(html).toMatch(/<span[^>]*aria-hidden="true"[^>]*>\*<\/span>/);
  });

  it("email is a readOnly input (not disabled) described by the managed hint; Read only pill", () => {
    const input = tag(render(), "portal-email");
    expect(input).toContain('readOnly=""');
    expect(input).not.toContain('disabled=""');
    expect(input).toContain('aria-describedby="portal-email-hint"');
    expect(input).toContain("anh@example.com");
    expect(render()).toContain(copy.readOnly);
    expect(render()).toContain(copy.emailManaged);
  });

  it('role badge renders for user, manager and admin; org name and initial from orgName; fallback without orgName shows only "Your organization"', () => {
    for (const t of TIERS) expect(render({ tier: t })).toContain(shellCopy.tiers[t]);
    const html = render();
    expect(html).toContain("Acme Labs");
    expect(html).toContain(">AL<");
    expect(html).toContain(copy.membership.yourOrg);
    const bare = render({ orgName: undefined });
    expect(bare).toContain(copy.membership.yourOrg);
    expect(bare).not.toContain("Acme");
  });

  it("field error invalid/required → aria-invalid and error text; no autofocus", () => {
    for (const e of ["invalid", "required"] as const) {
      const html = render({ nameError: e });
      expect(html).toContain(copy.errors[e]);
      expect(tag(html, "portal-name")).toContain('aria-invalid="true"');
      expect(html).not.toMatch(/autofocus/i);
    }
    expect(render()).not.toContain("aria-invalid");
  });

  it("footer: clean → Save and Cancel disabled; dirty → enabled; busy → disabled with saving label; character slot null → no character card", () => {
    const footerButtons = (html: string) =>
      html.match(/<button[^>]*>[^<]*(?:<span[^>]*>[^<]*<\/span>)?[^<]*<\/button>/g) ?? [];
    const clean = footerButtons(render());
    expect(clean.filter((b) => b.includes('disabled=""'))).toHaveLength(2);
    const dirty = render({
      footer: {
        status: { tone: "dirty", text: copy.footer.dirty },
        canSave: true,
        canCancel: true,
      },
    });
    expect(dirty).toContain('type="submit"');
    expect(dirty.match(/<button[^>]*type="submit"[^>]*>/)![0]).not.toContain('disabled=""');
    expect(dirty).toContain('role="status"');
    const busy = render({
      busy: true,
      footer: {
        status: { tone: "busy", text: copy.footer.saving },
        canSave: true,
        canCancel: true,
      },
    });
    expect(busy.match(/<button[^>]*type="submit"[^>]*>/)![0]).toContain('disabled=""');
    expect(busy).toContain(copy.footer.saving);
    expect(render({ character: null })).not.toContain("character-marker");
  });
});
