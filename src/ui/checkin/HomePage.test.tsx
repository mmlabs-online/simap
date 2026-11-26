import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Tier } from "@/lib/tier";
import { SessionProvider } from "../session";
import { HomeSwitch } from "./HomePage";

const render = (tier: Tier | null) =>
  renderToStaticMarkup(
    <SessionProvider value={tier ? { tier, email: "a@example.invalid" } : null}>
      <HomeSwitch checkin={<p>checkin-marker</p>} dashboard={<p>dashboard-marker</p>} />
    </SessionProvider>,
  );

describe("HomeSwitch", () => {
  it("user sees the check-in view at /", () => {
    const html = render("user");
    expect(html).toContain("checkin-marker");
    expect(html).not.toContain("dashboard-marker");
  });
  it("manager/admin see the dashboard at /", () => {
    for (const tier of ["manager", "admin"] as const) {
      const html = render(tier);
      expect(html).toContain("dashboard-marker");
      expect(html).not.toContain("checkin-marker");
    }
  });
  it("no session renders nothing", () => {
    expect(render(null)).toBe("");
  });
});
