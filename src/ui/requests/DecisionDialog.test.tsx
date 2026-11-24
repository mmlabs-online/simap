import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RequestListItemDto } from "@/lib/requests/types";
import { kitCopy } from "../copy/kit";
import { requestsCopy } from "../copy/requests";
import { DecisionDialog, type DecisionTarget } from "./DecisionDialog";

const noop = () => {};
const item = (name = "Ann"): RequestListItemDto => ({
  id: "1",
  status: "pending",
  seat: { id: "s1", code: "A1", roomId: "r1", roomCode: "R1" },
  subject: { id: "u1", displayName: name },
  createdAt: "2026-03-05T17:30:00.000000Z",
  decidedAt: null,
  decidedBy: null,
  currentOccupant: null,
});
const target = (over: Partial<DecisionTarget> = {}): DecisionTarget => ({
  item: item(),
  action: "approve",
  rivals: [],
  partial: false,
  ...over,
});
const render = (
  t: DecisionTarget | null,
  p: { submitting?: boolean; error?: string | null } = {},
) =>
  renderToStaticMarkup(
    <DecisionDialog
      target={t}
      submitting={p.submitting ?? false}
      error={p.error ?? null}
      onClose={noop}
      onConfirm={noop}
    />,
  );

describe("DecisionDialog", () => {
  it("null target renders nothing", () => {
    expect(render(null)).toBe("");
  });
  it("approve: title 'Approve request?', body names requester, seat and room; submit 'Approve'; cancel 'Keep pending'", () => {
    const html = render(target());
    expect(html).toContain("Approve request?");
    expect(html).toContain("Assign Ann to seat A1 in room R1.");
    expect(html).toContain(">Approve</button>");
    expect(html).toContain(">Keep pending</button>");
  });
  it("approve with rivals: 2 names listed; 5 rivals -> 3 names and 'and 2 more'; partial list -> 'including' wording; no rivals -> no rival sentence", () => {
    expect(render(target({ rivals: ["Bob", "Cy"] }))).toContain(
      "Approving rejects the other pending requests for this seat (Bob, Cy).",
    );
    expect(render(target({ rivals: ["B", "C", "D", "E", "F"] }))).toContain("(B, C, D and 2 more)");
    expect(render(target({ rivals: ["Bob"], partial: true }))).toContain(
      "Approving also rejects other pending requests for this seat, including Bob.",
    );
    expect(render(target())).not.toContain("Approving");
  });
  it("reject: title 'Reject request?', body names requester, seat, room and My requests; submit 'Reject'; no rival sentence", () => {
    const html = render(target({ action: "reject", rivals: ["Bob"] }));
    expect(html).toContain("Reject request?");
    expect(html).toContain(
      "Reject Ann&#x27;s request for seat A1 in room R1? They will see the decision in My requests.",
    );
    expect(html).toContain(">Reject</button>");
    expect(html).not.toContain("Approving");
  });
  it("error renders inside role=alert; submitting shows the kit saving label and disables submit", () => {
    expect(render(target(), { error: "Seat is taken." })).toMatch(
      /role="alert"[^>]*>Seat is taken\./,
    );
    const html = render(target(), { submitting: true });
    expect(html).toContain(kitCopy.saving);
    expect(html).toMatch(/<button type="submit" disabled/);
  });
  it("Vietnamese name (Nguyễn Thị Ánh) rendered unchanged", () => {
    expect(render(target({ item: item("Nguyễn Thị Ánh") }))).toContain(
      requestsCopy.decision.approveBody("Nguyễn Thị Ánh", "A1", "R1"),
    );
  });
});
