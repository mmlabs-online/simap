import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SeatDto } from "@/lib/seats/types";
import { portalCopy } from "../copy/portal";
import { SeatCard } from "./SeatCard";

const seat = (over: Partial<SeatDto> = {}): SeatDto =>
  ({
    id: "s1",
    code: "A1",
    roomCode: "R1",
    group: { id: "g", name: "Team", color: "#fff" },
    project: { id: "p", code: "P", name: "Proj" },
    ...over,
  }) as SeatDto;
const render = (s: SeatDto = seat(), busy = false) =>
  renderToStaticMarkup(<SeatCard seat={s} busy={busy} onRelease={() => {}} />);

describe("SeatCard", () => {
  it("shows the seat code (h4), roomLine, the Assigned pill, Group and Project names", () => {
    const html = render();
    expect(html).toMatch(/<h4[^>]*>A1<\/h4>/);
    expect(html).toContain(portalCopy.seat.roomLine("R1"));
    expect(html).toContain(`>${portalCopy.seat.assigned}<`);
    expect(html).toContain("Team");
    expect(html).toContain("Proj");
  });
  it('group and project null → "None" twice; Vietnamese names ("Nhóm Đổi Mới") are kept verbatim', () => {
    const none = render(seat({ group: null, project: null }));
    expect(none.split(`>${portalCopy.seat.noTag}<`)).toHaveLength(3);
    expect(render(seat({ group: { id: "g", name: "Nhóm Đổi Mới", color: "#fff" } }))).toContain(
      "Nhóm Đổi Mới",
    );
  });
  it("View on map links to /rooms/R1?seat=A1, with the grid_view and arrow_forward icons aria-hidden and the link text exactly portalCopy.seat.viewOnMap; no link when seatResultHref returns null", () => {
    const html = render();
    const link = html.match(/<a[^>]*href="\/rooms\/R1\?seat=A1"[^>]*>.*?<\/a>/)![0];
    expect(link).toMatch(/aria-hidden="true"[^>]*>grid_view<\/span>/);
    expect(link).toMatch(/aria-hidden="true"[^>]*>arrow_forward<\/span>/);
    expect(
      link
        .replace(/<[^>]*>/g, "")
        .replace("grid_view", "")
        .replace("arrow_forward", ""),
    ).toBe(portalCopy.seat.viewOnMap);
    expect(render(seat({ roomCode: ".." }))).not.toContain(portalCopy.seat.viewOnMap);
  });
  it("Release is an outlined button with the kit 44 px height; disabled when busy", () => {
    const html = render();
    const btn = html.match(/<button[^>]*>Release seat<\/button>/)![0];
    expect(btn).toContain('data-variant="outlined"');
    expect(btn).toContain("min-h-control");
    expect(btn).not.toContain("min-h-11");
    expect(btn).not.toContain('disabled=""');
    expect(render(seat(), true)).toMatch(/<button[^>]*\sdisabled=""[^>]*>Release seat</);
  });
  it("token classes: map link target, card title, no legacy classes", () => {
    const html = render();
    expect(html.match(/<a[^>]*href="\/rooms\/R1\?seat=A1"[^>]*>/)![0]).toContain("min-h-control");
    const h4 = html.match(/<h4[^>]*>/)![0];
    expect(h4).toContain("text-body");
    expect(h4).toContain("font-semibold");
    for (const bad of ["font-extrabold", "accent-orange", "gap-1.5"]) {
      expect(html).not.toContain(bad);
    }
  });
});
