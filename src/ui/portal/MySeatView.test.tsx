import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SeatDto } from "@/lib/seats/types";
import { portalCopy } from "../copy/portal";
import { MySeatView, type MySeatViewProps } from "./MySeatView";

const noop = () => {};
const seat = (over: Partial<SeatDto> = {}): SeatDto =>
  ({
    id: "s1",
    code: "A1",
    roomCode: "R1",
    group: { id: "g", name: "Team", color: "#fff" },
    project: { id: "p", code: "P", name: "Proj" },
    ...over,
  }) as SeatDto;
const render = (p: Partial<MySeatViewProps> = {}) =>
  renderToStaticMarkup(
    <MySeatView
      status="ready"
      seats={[seat()]}
      errorCode={null}
      empty={false}
      busy={false}
      notice={null}
      onRetry={noop}
      onRelease={noop}
      {...p}
    />,
  );

describe("MySeatView", () => {
  it("row shows room, seat code, group and project, link from seatResultHref, Release button", () => {
    const html = render();
    expect(html).toContain("A1");
    expect(html).toContain("R1");
    expect(html).toContain("Team");
    expect(html).toContain("Proj");
    expect(html).toContain('href="/rooms/R1?seat=A1"');
    expect(html).toContain(portalCopy.seat.viewOnMap);
    expect(html).toContain(`>${portalCopy.seat.release}<`);
    expect(html).toContain("min-h-11");
  });
  it("hides the link when the room code has no href", () => {
    expect(render({ seats: [seat({ roomCode: ".." })] })).not.toContain(portalCopy.seat.viewOnMap);
  });
  it("empty state has a link to /rooms", () => {
    const html = render({ seats: [], empty: true });
    expect(html).toContain(portalCopy.seat.empty);
    expect(html).toContain('href="/rooms"');
  });
  it("error state shows message and Retry", () => {
    const html = render({ status: "error", seats: [], errorCode: "unavailable" });
    expect(html).toContain('role="alert"');
    expect(html).toContain(portalCopy.seat.retry);
  });
  it("loading is aria-busy", () => {
    expect(render({ status: "loading", seats: [] })).toContain('aria-busy="true"');
  });
});
