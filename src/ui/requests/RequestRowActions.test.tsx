import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RequestListItemDto } from "@/lib/requests/types";
import { RequestRowActions } from "./RequestRowActions";
import { occupantHintId } from "./requests-state";

const noop = () => {};
const DIS = ' disabled=""';
const item = (over: Partial<RequestListItemDto> = {}): RequestListItemDto => ({
  id: "1",
  status: "pending",
  seat: { id: "s1", code: "A1", roomId: "r1", roomCode: "R1" },
  subject: { id: "u1", displayName: "Ann" },
  createdAt: "2026-03-05T17:30:00.000000Z",
  decidedAt: null,
  decidedBy: null,
  currentOccupant: null,
  ...over,
});
const render = (
  it: RequestListItemDto,
  busy: { id: string; action: "approve" | "reject" } | null = null,
) =>
  renderToStaticMarkup(
    <RequestRowActions item={it} busy={busy} onApprove={noop} onReject={noop} />,
  );
const buttons = (html: string) => html.match(/<button[^>]*>.*?<\/button>/g) ?? [];

describe("RequestRowActions", () => {
  it("pending, empty seat: Approve then Reject, both enabled, 44 px", () => {
    const [a, r] = buttons(render(item()));
    expect(a).toContain(">Approve<");
    expect(r).toContain(">Reject<");
    for (const b of [a, r]) {
      expect(b).not.toContain(DIS);
      expect(b).toContain("min-h-control");
      expect(b).not.toContain("min-h-11");
    }
  });
  it("non-pending item renders nothing", () => {
    for (const status of ["approved", "rejected", "cancelled"] as const) {
      expect(render(item({ status }))).toBe("");
    }
  });
  it("occupied seat: Approve disabled with aria-describedby=occupantHintId(id); Reject enabled", () => {
    const [a, r] = buttons(render(item({ currentOccupant: { id: "o", displayName: "Bob" } })));
    expect(a).toContain(DIS);
    expect(a).toContain(`aria-describedby="${occupantHintId("1")}"`);
    expect(r).not.toContain(DIS);
    expect(buttons(render(item()))[0]).not.toContain("aria-describedby");
  });
  it("busyId set: every button disabled; the busy row shows 'Approving...' or 'Rejecting...' for its action, other rows keep their labels", () => {
    const own = buttons(render(item(), { id: "1", action: "approve" }));
    expect(own.every((b) => b.includes(DIS))).toBe(true);
    expect(own[0]).toContain("Approving...");
    expect(own[1]).toContain(">Reject<");
    expect(buttons(render(item(), { id: "1", action: "reject" }))[1]).toContain("Rejecting...");
    const other = buttons(render(item(), { id: "2", action: "approve" }));
    expect(other.every((b) => b.includes(DIS))).toBe(true);
    expect(other[0]).toContain(">Approve<");
  });
});
