import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Tier } from "@/lib/auth/tier";
import { authErrorMessage } from "../copy/auth";
import { invitationsCopy } from "../copy/invitations";
import { InviteDialog, type InviteDialogProps } from "./InviteDialog";

const noop = () => {};
const render = (tier: Tier, p: Partial<InviteDialogProps> = {}) =>
  renderToStaticMarkup(
    <InviteDialog
      open
      tier={tier}
      email=""
      role="simap:user"
      submitting={false}
      error={null}
      notice={null}
      onEmail={noop}
      onRole={noop}
      onClose={noop}
      onSubmit={noop}
      onRetryRecord={noop}
      {...p}
    />,
  );
const options = (html: string) => [...html.matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]);

describe("InviteDialog", () => {
  it("manager sees only User", () => {
    const html = render("manager");
    expect(options(html)).toEqual(["simap:user"]);
    expect(html).toContain(invitationsCopy.roles["simap:user"]);
    expect(html).not.toContain(invitationsCopy.roles["simap:manager"]);
  });
  it("admin sees User and Manager, never Admin", () => {
    const html = render("admin");
    expect(options(html)).toEqual(["simap:user", "simap:manager"]);
    expect(html).not.toContain("simap:admin");
  });
  it("user tier renders nothing", () => {
    expect(render("user")).toBe("");
  });
  it("shows an error message", () => {
    const text = authErrorMessage({ code: "org_invite_unavailable" });
    expect(render("admin", { error: text })).toContain(text);
  });
  it("sent notice does not promise delivery", () => {
    const html = render("admin", {
      notice: { kind: "sent", text: invitationsCopy.sent("a@x.vn") },
    });
    expect(html).toContain("If the address can receive mail");
  });
  it("sentNotRecorded shows the warning and a retry button", () => {
    const html = render("admin", { notice: { kind: "sentNotRecorded" } });
    expect(html).toContain(invitationsCopy.sentNotRecorded);
    expect(html).toContain(invitationsCopy.retryRecord);
    expect(html).toMatch(/<button[^>]*min-h-control[^>]*data-variant="outlined"/);
    expect(html).toMatch(/role="status"[^>]*>\s*<span class="text-label/);
    expect(html).not.toContain("text-[");
  });
});
