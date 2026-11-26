import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { portalCopy } from "../copy/portal";
import { PortalTabs } from "./PortalTabs";
import { PORTAL_TABS, panelId, tabId } from "./portal-state";

const render = (active: "devices" | "profile") =>
  renderToStaticMarkup(<PortalTabs tabs={PORTAL_TABS} active={active} onSelect={() => {}} />);

describe("PortalTabs", () => {
  it("renders a labelled tablist with roving tabIndex and aria links", () => {
    const html = render("profile");
    expect(html).toContain('role="tablist"');
    expect(html).toContain(`aria-label="${portalCopy.tablistLabel}"`);
    expect(html.match(/role="tab"/g)).toHaveLength(2);
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    const profile = html.match(/<button[^>]*id="portal-tab-profile"[^>]*>/)![0];
    expect(profile).toContain('aria-selected="true"');
    expect(profile).toContain('tabindex="0"');
    expect(profile).toContain(`aria-controls="${panelId("profile")}"`);
    const devices = html.match(/<button[^>]*id="portal-tab-devices"[^>]*>/)![0];
    expect(devices).toContain('aria-selected="false"');
    expect(devices).toContain('tabindex="-1"');
    expect(html).toContain(tabId("devices"));
    expect(html).toContain(portalCopy.tabs.devices);
  });
});
