import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ButtonAction } from "@/lib/checkin-popup";
import { CheckinButton } from "./CheckinButton";

const render = (action: ButtonAction, busy = false, errorCode: string | null = null) =>
  renderToStaticMarkup(
    <CheckinButton action={action} busy={busy} errorCode={errorCode} onPress={() => {}} />,
  );

describe("CheckinButton", () => {
  it("checkin -> Check in, checkout -> Check out, openPopup -> Check in, retry -> Try again; pointer-events-auto, pixel variant", () => {
    expect(render({ kind: "checkin", roomId: "r" })).toContain(">Check in<");
    expect(render({ kind: "checkout" })).toContain(">Check out<");
    expect(render({ kind: "openPopup" })).toContain(">Check in<");
    const html = render({ kind: "retry" });
    expect(html).toContain(">Try again<");
    expect(html).toContain("pointer-events-auto");
    expect(html).not.toContain("px-card");
    expect(html).toContain('data-variant="pixel"');
  });
  it("error text is a role=alert with the API message", () => {
    const html = render({ kind: "checkout" }, false, "unavailable");
    expect(html).toContain('role="alert"');
    expect(html).toContain("text-danger");
    expect(html).toContain("text-label");
  });
  it("hidden renders nothing; busy -> disabled + aria-busy", () => {
    expect(render({ kind: "hidden" })).toBe("");
    const html = render({ kind: "checkout" }, true);
    expect(html).toContain("disabled");
    expect(html).toContain('aria-busy="true"');
  });
});
