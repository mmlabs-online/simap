import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MyRequestDto } from "@/lib/requests/types";
import { requestsCopy } from "../copy/requests";
import { formatRequestTime } from "../requests/requests-state";
import { MyRequestRow } from "./MyRequestRow";

const DECIDED = "2026-03-05T18:00:00.000000Z";
const req = (over: Partial<MyRequestDto> = {}): MyRequestDto => ({
  id: "1",
  status: "pending",
  seat: { id: "s1", code: "A1", roomId: "r1", roomCode: "R1" },
  subject: { id: "u1", displayName: "Ann" },
  createdAt: "2026-03-05T17:30:00.000000Z",
  decidedAt: null,
  decidedBy: null,
  isNew: false,
  ...over,
});
const render = (item: MyRequestDto, isNew = false, cancellingId: string | null = null) =>
  renderToStaticMarkup(
    <MyRequestRow item={item} isNew={isNew} cancellingId={cancellingId} onCancel={() => {}} />,
  );
const decided = (status: MyRequestDto["status"], by: string | null, at: string | null = DECIDED) =>
  req({
    status,
    decidedAt: at,
    decidedBy: by === null ? null : { id: "m", displayName: by },
  });

describe("MyRequestRow", () => {
  it("pending: history icon, Pending warning pill with a dot, Requested 06 Mar 2026, 00:30 (UTC+7) in <time dateTime>, no decision line, Cancel request button", () => {
    const html = render(req());
    expect(html).toContain(">history<");
    expect(html).toMatch(/bg-warning-container[^>]*><span aria-hidden="true"[^>]*><\/span>Pending/);
    expect(html).toContain(
      `<time dateTime="2026-03-05T17:30:00.000000Z">${requestsCopy.requestedAt("06 Mar 2026, 00:30")}</time>`,
    );
    expect(html.match(/<time/g)).toHaveLength(1);
    expect(html).toContain(`>${requestsCopy.mine.cancel}<`);
  });
  it('pending with cancellingId set: every Cancel disabled; the busy row shows "Cancelling..."', () => {
    expect(render(req(), false, "other")).toMatch(/<button[^>]*\sdisabled=""/);
    const busy = render(req(), false, "1");
    expect(busy).toContain(`>${requestsCopy.mine.cancelling}<`);
    expect(busy).toMatch(/<button[^>]*\sdisabled=""/);
    expect(render(req())).not.toContain('disabled=""');
  });
  it('approved: check icon, success pill, decidedLine("approved","Nguyễn Thị Hương",…) in <time>, no button', () => {
    const html = render(decided("approved", "Nguyễn Thị Hương"));
    expect(html).toContain(">check<");
    expect(html).toContain("bg-success-container");
    expect(html).toContain(
      `<time dateTime="${DECIDED}">${requestsCopy.decidedLine("approved", "Nguyễn Thị Hương", formatRequestTime(DECIDED))}</time>`,
    );
    expect(html).not.toContain("<button");
  });
  it('rejected: close icon, danger pill, "Rejected by … on …", no button', () => {
    const html = render(decided("rejected", "Bob"));
    expect(html).toContain(">close<");
    expect(html).toContain("bg-error-container");
    expect(html).toContain("Rejected by Bob on 06 Mar 2026, 01:00");
    expect(html).not.toContain("<button");
  });
  it('cancelled: block icon, neutral pill, "Cancelled by Ann on …"; decidedBy null → "Cancelled on …"; decidedAt null → no decision line', () => {
    const html = render(decided("cancelled", "Ann"));
    expect(html).toContain(">block<");
    expect(html).toContain("Cancelled by Ann on 06 Mar 2026, 01:00");
    expect(html).not.toContain("<button");
    expect(render(decided("cancelled", null))).toContain("Cancelled on 06 Mar 2026, 01:00");
    expect(html.match(/<time/g)).toHaveLength(2);
    expect(render(decided("cancelled", "Ann", null)).match(/<time/g)).toHaveLength(1);
  });
  it('seat line shows "Seat A1" bold and "in room R1"; the New pill only when isNew', () => {
    const html = render(req());
    expect(html).toContain("<strong");
    expect(html).toContain(">Seat A1</strong>");
    expect(html).toContain("in room R1");
    expect(html).not.toContain(`>${requestsCopy.mine.newChip}<`);
    expect(render(req(), true)).toContain(`>${requestsCopy.mine.newChip}<`);
  });
});
