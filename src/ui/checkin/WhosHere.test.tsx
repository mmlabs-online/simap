import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { WhosHereRow } from "@/lib/presence/whos-here";
import { presenceCopy } from "../copy/presence";
import { WhosHere } from "./WhosHere";

const row = (p: Partial<WhosHereRow> = {}): WhosHereRow => ({
  memberId: "m1",
  name: "Nguyễn Thị Ánh",
  unnamed: false,
  seatCode: "A1",
  checkedInAt: "2026-03-06T01:30:00Z",
  time: "08:30",
  source: "self",
  look: { skin: 0, hair: 0, style: 1, shirt: 0 },
  focusable: true,
  ...p,
});
const render = (p: Partial<Parameters<typeof WhosHere>[0]> = {}) =>
  renderToStaticMarkup(
    <WhosHere
      status="ready"
      rows={[row()]}
      stale={false}
      atlas={null}
      onFocus={() => {}}
      onRetry={() => {}}
      {...p}
    />,
  );

describe("WhosHere", () => {
  it("one button per row with name, seat code, time with dateTime, source; Vietnamese name intact", () => {
    const html = render({
      rows: [row(), row({ memberId: "m2", source: "provider", time: "09:05" })],
    });
    expect((html.match(/<button/g) ?? []).length).toBe(2);
    expect(html).toContain("Nguyễn Thị Ánh");
    expect(html).toContain('<time dateTime="2026-03-06T01:30:00Z">08:30</time>');
    expect(html).toContain("Self");
    expect(html).toContain("Third-party");
    expect(html).toContain("A1");
  });

  it("rows are 44 px with the global focus ring and a semibold name", () => {
    const html = render({ rows: [row()] });
    expect(html).toMatch(/<button[^>]*min-h-control/);
    expect(html).not.toContain("focus-visible:");
    expect(html).toMatch(/<span class="[^"]*font-semibold[^"]*">Nguyễn Thị Ánh/);
  });

  it("a row whose seat is not on the map is disabled with the hint", () => {
    const html = render({ rows: [row({ focusable: false })] });
    expect(html).toMatch(/<button[^>]*disabled/);
    expect(html).toContain(presenceCopy.notOnMap);
    expect(html).not.toContain("opacity-");
  });

  it("empty shows the empty text; loading is aria-busy; error has an alert and a retry button; stale shows a notice", () => {
    expect(render({ rows: [] })).toContain(presenceCopy.empty);
    expect(render({ status: "loading" })).toContain('aria-busy="true"');
    const error = render({ status: "error" });
    expect(error).toContain('role="alert"');
    expect(error).toContain(presenceCopy.retry);
    const stale = render({ stale: true });
    expect(stale).toContain('role="status"');
    expect(stale).toContain(presenceCopy.stale);
    expect(render()).not.toContain(presenceCopy.stale);
  });

  it("the head is aria-hidden and the row has no image of a person", () => {
    const html = render();
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("<img");
  });
});
