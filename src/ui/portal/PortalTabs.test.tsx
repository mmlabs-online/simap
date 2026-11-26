import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { portalCopy } from "../copy/portal";
import { PortalTabs } from "./PortalTabs";
import { PORTAL_TABS, panelId, tabId, type PortalTab } from "./portal-state";

const render = (active: PortalTab) =>
  renderToStaticMarkup(<PortalTabs tabs={PORTAL_TABS} active={active} onSelect={() => {}} />);

describe("PortalTabs", () => {
  it("renders a labelled tablist with roving tabIndex and aria links", () => {
    const html = render("profile");
    expect(html).toContain('role="tablist"');
    expect(html).toContain(`aria-label="${portalCopy.tablistLabel}"`);
    expect(html.match(/role="tab"/g)).toHaveLength(3);
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    const profile = html.match(/<button[^>]*id="portal-tab-profile"[^>]*>/)![0];
    expect(profile).toContain('aria-selected="true"');
    expect(profile).toContain('tabindex="0"');
    expect(profile).toContain(`aria-controls="${panelId("profile")}"`);
    const devices = html.match(/<button[^>]*id="portal-tab-devices"[^>]*>/)![0];
    expect(devices).toContain('aria-selected="false"');
    expect(devices).toContain('tabindex="-1"');
    expect(html).toContain(tabId("devices"));
    expect(html).toContain("portal-tab-seat");
    expect(html).toContain(portalCopy.tabs.seat);
    const order = ["seat", "devices", "profile"].map((t) => html.indexOf(`id="portal-tab-${t}"`));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(html).toContain(portalCopy.tabs.devices);
  });
});
