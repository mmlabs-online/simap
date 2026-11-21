import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
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

  it("admin on /rooms/A1: nav landmark, 6 links, one aria-current", () => {
    const html = render("admin", "/rooms/A1");
    expect(html).toContain(`<nav aria-label="${shellCopy.navLabel}"`);
    expect(hrefs(html)).toEqual(["/", "/rooms", "/devices", "/members", "/approvals", "/audit"]);
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

  it("user has no approvals link; manager has it", () => {
    expect(hrefs(render("user"))).not.toContain("/approvals");
    expect(hrefs(render("manager"))).toContain("/approvals");
  });
});
