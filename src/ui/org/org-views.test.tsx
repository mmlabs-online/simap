import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { authCopy } from "../copy/auth";
import { orgCopy } from "../copy/org";
import { OrgPickerView } from "./OrgPickerView";
import { OrgSwitcherDialog } from "./OrgSwitcherDialog";

const noop = () => {};
const html = renderToStaticMarkup;
const A = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Tổ chức Á" };
const B = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Beta <b>" };

describe("OrgPickerView", () => {
  it("lists one button per org in a labelled list, names intact and escaped; sign-out present", () => {
    const out = html(<OrgPickerView orgs={[A, B]} onPick={noop} onSignOut={noop} />);
    expect(out).toContain(`aria-label="${orgCopy.picker.listLabel}"`);
    expect(out.match(/<li>/g)).toHaveLength(2);
    expect(out).toContain("Tổ chức Á");
    expect(out).toContain("Beta &lt;b&gt;");
    expect(out).toContain(authCopy.actions.signOut);
    expect(out).not.toContain("status");
  });

  it("shows the org_denied notice in a status region", () => {
    const out = html(
      <OrgPickerView orgs={[A]} notice="org_denied" onPick={noop} onSignOut={noop} />,
    );
    expect(out).toContain(orgCopy.notices.org_denied);
    expect(out).toContain('role="status"');
  });

  it("busyId disables all org buttons and marks the busy one aria-busy", () => {
    const out = html(<OrgPickerView orgs={[A, B]} busyId={B.id} onPick={noop} onSignOut={noop} />);
    expect(out.match(/aria-busy="true"/g)).toHaveLength(1);
    expect(out).toContain(orgCopy.picker.entering);
    expect(out.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe("OrgSwitcherDialog", () => {
  const base = { open: true, currentId: B.id, onSwitch: noop, onRetry: noop, onClose: noop };

  it("renders a radio per org, the current one checked and marked", () => {
    const out = html(<OrgSwitcherDialog {...base} state={{ status: "ready", orgs: [A, B] }} />);
    expect(out.match(/type="radio"/g)).toHaveLength(2);
    expect(out.match(/checked=""/g)).toHaveLength(1);
    expect(out).toContain(orgCopy.switcher.current);
    expect(out).toContain("Tổ chức Á");
  });

  it("loading and failed states; failed offers Try again", () => {
    const loading = html(<OrgSwitcherDialog {...base} state={{ status: "loading" }} />);
    expect(loading).toContain(orgCopy.switcher.loading);
    expect(loading).not.toContain('type="radio"');
    const failed = html(<OrgSwitcherDialog {...base} state={{ status: "failed" }} />);
    expect(failed).toContain(orgCopy.switcher.loadFailed);
    expect(failed).toContain(orgCopy.switcher.retry);
  });

  it("a single org shows the 'only this organization' text", () => {
    const out = html(<OrgSwitcherDialog {...base} state={{ status: "ready", orgs: [B] }} />);
    expect(out).toContain(orgCopy.switcher.only);
    expect(out).not.toContain('type="radio"');
  });
});
