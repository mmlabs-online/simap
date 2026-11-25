import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { NavId } from "@/lib/nav";
import type { DevBadge } from "@/lib/session";
import type { Tier } from "@/lib/tier";
import { AppShellView } from "./AppShellView";
import { devTokenCopy } from "./copy/dev-token";
import { shellCopy } from "./copy/shell";

const render = (tier: Tier | null, pathname = "/") =>
  renderToStaticMarkup(
    <AppShellView
      session={tier ? { tier, email: "an.nguyen@example.invalid", orgName: "Tổ chức" } : null}
      pathname={pathname}
      actions={{}}
    >
      <p>child-marker</p>
    </AppShellView>,
  );

const hrefs = (html: string) =>
  [...(/<nav[\s\S]*<\/nav>/.exec(html)?.[0] ?? "").matchAll(/<a [^>]*href="([^"]+)"/g)].map(
    (m) => m[1],
  );

describe("AppShellView", () => {
  it("shows the org name; the switch button only when switchOrg is given", () => {
    const withAction = renderToStaticMarkup(
      <AppShellView
        session={{ tier: "user", email: "a@example.invalid", orgName: "Tổ chức" }}
        pathname="/"
        actions={{ switchOrg: () => {} }}
      >
        <p>x</p>
      </AppShellView>,
    );
    expect(withAction).toContain("Tổ chức");
    expect(withAction).toContain(shellCopy.actions.switchOrg);
    const without = render("user");
    expect(without).toContain("Tổ chức");
    expect(without).not.toContain(shellCopy.actions.switchOrg);
  });

  it("devToken: badge shown, sign-out and switch absent; prod variant is red and says so", () => {
    const shell = (devToken?: DevBadge) =>
      renderToStaticMarkup(
        <AppShellView
          session={{ tier: "user", email: "a@example.invalid", devToken }}
          pathname="/"
          actions={{ switchOrg: () => {}, signOut: () => {} }}
        >
          <p>x</p>
        </AppShellView>,
      );
    const dev = shell(devTokenCopy.badge);
    expect(dev).toContain(devTokenCopy.badge.label);
    expect(dev).toContain("bg-amber-300");
    expect(dev).not.toContain(shellCopy.actions.signOut);
    const prod = shell({ ...devTokenCopy.prodBadge, prod: true });
    expect(prod).toContain("Production data");
    expect(prod).toContain("bg-red-600");
    expect(prod).not.toContain(devTokenCopy.badge.label);
    expect(prod).not.toContain(shellCopy.actions.signOut);
  });

  it("no devToken: no badge, sign-out still rendered", () => {
    const html = render("user");
    expect(html).not.toContain(devTokenCopy.badge.label);
    expect(html).not.toContain("bg-amber-300");
    expect(html).toContain(shellCopy.actions.signOut);
  });

  it("signed out shows the sign-in placeholder and no nav", () => {
    const html = render(null);
    expect(html).toContain(shellCopy.signedOut.title);
    expect(html).not.toContain("<nav");
    expect(html).not.toContain(shellCopy.actions.signOut);
    expect(html).not.toContain("child-marker");
  });

  it("admin on /rooms/A1: nav landmark, 9 links, one aria-current", () => {
    const html = render("admin", "/rooms/A1");
    expect(html).toContain(`<nav aria-label="${shellCopy.navLabel}"`);
    expect(hrefs(html)).toEqual([
      "/",
      "/search",
      "/rooms",
      "/devices",
      "/members",
      "/requests",
      "/approvals",
      "/audit",
      "/device-types",
    ]);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(
      /<a [^>]*aria-current="page"[^>]*href="\/rooms"/.test(html) ||
        /<a [^>]*href="\/rooms"[^>]*aria-current="page"/.test(html),
    ).toBe(true);
    expect(html).toContain(shellCopy.tiers.admin);
    expect(html).toContain('href="#main"');
    expect(html).toContain(shellCopy.skipLink);
    expect(html).toContain('<main id="main"');
    expect(html).toContain("child-marker");
  });

  it("role badge is hidden below lg by its wrapper, not by its own class", () => {
    const html = render("admin");
    expect(html).toContain('<span class="hidden lg:inline-flex"><span class="inline-flex');
    expect(html).not.toMatch(/class="inline-flex[^"]*hidden/);
  });

  it("roomSwitcher: absent by default, between header and main with a prop, absent when signed out", () => {
    const shell = (tier: Tier | null, withSwitcher: boolean) =>
      renderToStaticMarkup(
        <AppShellView
          session={tier ? { tier, email: "a@example.invalid" } : null}
          pathname="/"
          actions={{}}
          roomSwitcher={withSwitcher ? <p>switcher-marker</p> : undefined}
        >
          <p>x</p>
        </AppShellView>,
      );
    const none = shell("user", false);
    expect(none).not.toContain("switcher-marker");
    expect(none).not.toContain('data-slot="room-switcher"');
    const withIt = shell("user", true);
    const at = withIt.indexOf("switcher-marker");
    expect(at).toBeGreaterThan(withIt.indexOf("</header>"));
    expect(at).toBeLessThan(withIt.indexOf("<main"));
    expect(shell(null, true)).not.toContain("switcher-marker");
  });

  it("user has no approvals link; manager has it; no tier has a groups link (D65)", () => {
    expect(hrefs(render("user"))).not.toContain("/approvals");
    expect(hrefs(render("manager"))).toContain("/approvals");
    expect(hrefs(render("user"))).not.toContain("/groups");
    expect(hrefs(render("manager"))).not.toContain("/groups");
  });

  describe("nav badge", () => {
    const withBadges = (tier: Tier, badges?: Partial<Record<NavId, number>>) =>
      renderToStaticMarkup(
        <AppShellView
          session={{ tier, email: "a@example.invalid" }}
          pathname="/"
          actions={{}}
          badges={badges}
        >
          <p>x</p>
        </AppShellView>,
      );
    const link = (html: string, href: string) =>
      new RegExp(`<a [^>]*href="${href}"[^>]*>.*?</a>`).exec(html)?.[0] ?? "";

    it("count on the myRequests link with aria-hidden numeral and sr-only text", () => {
      const three = link(withBadges("user", { myRequests: 3 }), "/requests");
      expect(three).toMatch(/<span aria-hidden="true" class="absolute[^>]*>3</);
      expect(three).toContain(`<span class="sr-only">${shellCopy.badge.newDecisions(3)}</span>`);
      expect(link(withBadges("user", { myRequests: 1 }), "/requests")).toContain("1 new decision<");
    });
    it("caps at 9+ visibly and keeps the exact count for screen readers", () => {
      const many = link(withBadges("user", { myRequests: 12 }), "/requests");
      expect(many).toMatch(/<span aria-hidden="true" class="absolute[^>]*>9\+</);
      expect(many).toContain("12 new decisions");
    });
    it("0 or no prop: no badge markup", () => {
      for (const b of [undefined, { myRequests: 0 }]) {
        const html = withBadges("user", b);
        expect(link(html, "/requests")).not.toContain('<span aria-hidden="true" class="absolute');
        expect(html).not.toContain("new decision");
      }
    });
    it("devices badge: numeral aria-hidden, sr-only '3 incoming transfers' / '1 incoming transfer'", () => {
      const three = link(withBadges("user", { devices: 3 }), "/devices");
      expect(three).toMatch(/<span aria-hidden="true" class="absolute[^>]*>3</);
      expect(three).toContain(
        `<span class="sr-only">${shellCopy.badge.incomingTransfers(3)}</span>`,
      );
      expect(three).toContain("3 incoming transfers");
      expect(link(withBadges("user", { devices: 1 }), "/devices")).toContain(
        "1 incoming transfer<",
      );
    });
    it("devices 12: 9+ visible, '12 incoming transfers' for screen readers", () => {
      const many = link(withBadges("user", { devices: 12 }), "/devices");
      expect(many).toMatch(/<span aria-hidden="true" class="absolute[^>]*>9\+</);
      expect(many).toContain("12 incoming transfers");
    });
    it("devices 0 or missing: no badge markup, no 'incoming transfer' text", () => {
      for (const b of [undefined, { devices: 0 }]) {
        const html = withBadges("user", b);
        expect(link(html, "/devices")).not.toContain('<span aria-hidden="true" class="absolute');
        expect(html).not.toContain("incoming transfer");
      }
    });
    it("myRequests and devices together: each link has its own text", () => {
      const html = withBadges("user", { myRequests: 2, devices: 5 });
      expect(link(html, "/requests")).toContain("2 new decisions");
      expect(link(html, "/requests")).not.toContain("incoming transfer");
      expect(link(html, "/devices")).toContain("5 incoming transfers");
      expect(link(html, "/devices")).not.toContain("new decision");
    });
    it("a badge for a nav id the tier cannot see is not rendered", () => {
      const html = withBadges("user", { approvals: 2 });
      expect(html).not.toContain("/approvals");
      expect(html).not.toContain("2 new decisions");
    });
  });
});
