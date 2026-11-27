import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { apiErrorMessage } from "../copy/api";
import { CheckinPopup, type CheckinPopupProps } from "./CheckinPopup";

const props: CheckinPopupProps = {
  open: true,
  seatRooms: [
    {
      roomId: "r1",
      code: "A1",
      name: "Lab",
      seatCode: "A1-02",
      count: 3,
      lastCheckedInAt: "2026-03-06T08:30:00Z",
    },
    { roomId: "r2", code: "B2", name: "Annex", seatCode: "B2-01", count: 0, lastCheckedInAt: null },
    { roomId: "r3", code: "C3", name: "Depot", seatCode: "C3-01", count: 1, lastCheckedInAt: null },
    {
      roomId: "r4",
      code: "D4",
      name: "Hall",
      seatCode: "D4-01",
      count: null,
      lastCheckedInAt: null,
    },
  ],
  locked: [{ roomId: "r9", code: "Z/9", name: "Vault" }],
  thumbs: { r1: { w: 4, h: 3, cells: [{ x: 0, y: 0, w: 4, h: 3, kind: "floor" }] } },
  selectedCode: "A1",
  busy: false,
  errorCode: null,
  onSelect: () => {},
  onCheckIn: () => {},
  onJustLook: () => {},
};
const render = (over: Partial<CheckinPopupProps> = {}) =>
  renderToStaticMarkup(<CheckinPopup {...props} {...over} />);

describe("CheckinPopup", () => {
  it("open=false renders nothing", () => {
    expect(render({ open: false })).toBe("");
  });
  it("renders a <dialog> with aria-labelledby the title and aria-describedby the intro; px-frame; title bar bg-tile text-text-pixel; body has no px-title/px-heading class", () => {
    const html = render();
    const title = /aria-labelledby="([^"]+)"/.exec(html)?.[1];
    const desc = /aria-describedby="([^"]+)"/.exec(html)?.[1];
    expect(html.startsWith("<dialog")).toBe(true);
    expect(html).toContain(`<h2 id="${title}"`);
    expect(html).toContain(`<p id="${desc}"`);
    expect(html).toContain("px-frame");
    expect(html).toMatch(/class="[^"]*bg-tile[^"]*text-text-pixel[^"]*"><h2/);
    expect(html).not.toContain("px-title");
    expect(html).not.toContain("px-heading");
  });
  it("one native radio per seat room inside a fieldset with a legend; the radio of selectedCode is checked", () => {
    const html = render();
    expect(html).toContain("<fieldset");
    expect(html).toContain("<legend");
    expect(html.match(/type="radio"/g)).toHaveLength(4);
    expect(html).toMatch(/type="radio"[^>]*checked=""[^>]*value="A1"/);
    expect(html).not.toMatch(/checked=""[^>]*value="B2"/);
  });
  it('seat row shows "<code> - <name>", "Your seat: <seat>", count text and an svg thumbnail', () => {
    const html = render();
    expect(html).toContain("A1 - Lab");
    expect(html).toContain("Your seat: A1-02");
    expect(html).toContain("3 here now");
    expect(html).toContain("Nobody here yet");
    expect(html).toContain("1 here now");
    expect(html).toContain("Count unavailable");
    expect(html).toContain("<svg");
    expect(html).toContain('aria-hidden="true"');
  });
  it('last check-in in UTC+7 ("06 Mar 2026, 15:30" for 2026-03-06T08:30:00Z) and "never"', () => {
    const html = render();
    expect(html).toContain("Last check-in: 06 Mar 2026, 15:30");
    expect(html).toContain("Last check-in: never");
  });
  it("locked rooms come after the seat rooms in DOM order under their heading, have no radio, and Request a seat links to /rooms/<encoded code>", () => {
    const html = render();
    expect(html.indexOf("D4 - Hall")).toBeLessThan(html.indexOf("No seat in these rooms"));
    expect(html.indexOf("No seat in these rooms")).toBeLessThan(html.indexOf("Z/9 - Vault"));
    expect(html).not.toContain('value="Z/9"');
    expect(html).toMatch(/<a [^>]*href="\/rooms\/Z%2F9"[^>]*>Request a seat</);
    expect(html).toContain("Locked");
    expect(render({ locked: [] })).not.toContain("No seat in these rooms");
  });
  it('primary "Check in to <code>" has data-variant=pixel, no px-card; "Just look" present; busy -> primary disabled + aria-busy; error -> role=alert with the API text', () => {
    const html = render();
    expect(html).toContain('data-variant="pixel"');
    expect(html).not.toContain("px-card");
    expect(html).toContain(">Check in to A1<");
    expect(html).toContain(">Just look<");
    const busy = render({ busy: true });
    expect(busy).toMatch(
      /aria-busy="true"[^>]*disabled|disabled=""[^>]*aria-busy="true"|disabled[^>]*aria-busy="true"/,
    );
    const err = render({ errorCode: "no_seat_in_room" });
    expect(err).toContain('role="alert"');
    expect(err).toContain(apiErrorMessage("no_seat_in_room"));
  });
  it("390 px classes: dialog w-[min(--spacing(128),calc(100vw-var(--space-6)))] max-h-[90dvh], scrolling list, actions full width", () => {
    const html = render();
    expect(html).toContain("w-[min(--spacing(128),calc(100vw-var(--space-6)))]");
    expect(html).toContain("max-h-[90dvh]");
    expect(html).toContain("overflow-auto");
    expect(html).toContain("w-full sm:w-auto");
    expect(html).toContain("min-h-control");
    expect(html).not.toContain("min-h-11");
  });
  it("pixel chrome: selected row border-pixel-primary, others transparent, 20 px radios, tonal Just look, no legacy classes", () => {
    const html = render();
    expect(html).toContain("border-3 border-pixel-primary");
    expect(html).toContain("border-3 border-transparent");
    expect(html).toContain("size-5");
    expect(html).toMatch(/<button[^>]*data-variant="tonal"[^>]*>Just look</);
    expect(html).not.toContain("rounded-none");
    for (const bad of ["opacity-90", "text-[", "tracking-[", "border-[", "shadow-["]) {
      expect(html).not.toContain(bad);
    }
  });
});
