import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { portalCopy } from "../copy/portal";
import { PortalTabs } from "./PortalTabs";
import { PORTAL_TABS, PORTAL_TAB_ICONS, panelId, tabId, type PortalTab } from "./portal-state";

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

  it("each tab has its PORTAL_TAB_ICONS icon; only Profile shows the You chip; selected tab has text-primary", () => {
    const html = render("devices");
    const tab = (t: PortalTab) =>
      html.match(new RegExp(`<button[^>]*id="portal-tab-${t}"[^>]*>.*?</button>`))![0];
    for (const t of PORTAL_TABS) {
      expect(tab(t)).toContain(`>${PORTAL_TAB_ICONS[t]}</span>`);
      expect(tab(t).includes(portalCopy.tabChips.profile!)).toBe(t === "profile");
    }
    expect(tab("profile")).toMatch(/<span[^>]*aria-hidden="true"[^>]*>You<\/span>/);
    expect(tab("devices")).toContain("text-primary");
    expect(tab("seat")).not.toContain("text-primary");
  });
});
