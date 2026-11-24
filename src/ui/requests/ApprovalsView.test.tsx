import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { REQUEST_STATUSES, type RequestListItemDto } from "@/lib/requests/types";
import { apiErrorMessage } from "../copy/api";
import { requestsCopy } from "../copy/requests";
import { ApprovalsView, type ApprovalsViewProps } from "./ApprovalsView";
import { formatRequestTime } from "./requests-state";

const noop = () => {};
const req = (over: Partial<RequestListItemDto> & { id: string }): RequestListItemDto => ({
  status: "pending",
  seat: { id: "s1", code: "A1", roomId: "r1", roomCode: "R1" },
  subject: { id: "u1", displayName: "Ann" },
  createdAt: "2026-03-05T17:30:00.000000Z",
  decidedAt: null,
  decidedBy: null,
  currentOccupant: null,
  ...over,
});
const render = (p: Partial<ApprovalsViewProps> = {}) =>
  renderToStaticMarkup(
    <ApprovalsView
      state="ready"
      filter="pending"
      items={[req({ id: "1" })]}
      hasMore={false}
      loadingMore={false}
      errorCode={null}
      onFilter={noop}
      onRetry={noop}
      onLoadMore={noop}
      {...p}
    />,
  );

describe("ApprovalsView", () => {
  it("loading: aria-busy card, no list", () => {
    const html = render({ state: "loading", items: [] });
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("<ul");
  });
  it("error: role=alert with apiErrorMessage(code) and Retry button", () => {
    const html = render({ state: "error", items: [], errorCode: "unavailable" });
    expect(html).toContain('role="alert"');
    expect(html).toContain(apiErrorMessage("unavailable"));
    expect(html).toContain(requestsCopy.retry);
  });
  it("empty per status shows its own text", () => {
    for (const s of REQUEST_STATUSES) {
      expect(render({ items: [], filter: s })).toContain(requestsCopy.emptyFor[s]);
    }
    expect(render({ items: [] })).toContain("No pending requests.");
  });
  it("forbidden: no-access message, no radiogroup, no list", () => {
    const html = render({ state: "forbidden" });
    expect(html).toContain(requestsCopy.noAccess);
    expect(html).not.toContain("radiogroup");
    expect(html).not.toContain("<ul");
  });
  it("ready: one card per item with requester, seat line, time; pending chip checked", () => {
    const html = render({ items: [req({ id: "1" }), req({ id: "2" })] });
    expect(html.match(/<li/g)).toHaveLength(2);
    expect(html).toContain("Ann");
    expect(html).toContain(requestsCopy.seatLine("A1", "R1"));
    expect(html).toContain('<time dateTime="2026-03-05T17:30:00.000000Z">');
    expect(html).toContain(requestsCopy.requestedAt("06 Mar 2026, 00:30"));
    expect(html).toMatch(/aria-checked="true"[^>]*>Pending/);
  });
  it("pending row: occupant shows the warning, none shows seat empty", () => {
    const occ = render({
      items: [req({ id: "1", currentOccupant: { id: "o", displayName: "Bob" } })],
    });
    expect(occ).toContain(requestsCopy.occupiedBy("Bob"));
    expect(render()).toContain(requestsCopy.seatEmpty);
  });
  it("decided row: status chip and decided line with decider; null decider -> no name", () => {
    const decided = req({
      id: "1",
      status: "approved",
      decidedAt: "2026-03-06T03:00:00.000000Z",
      decidedBy: { id: "m", displayName: "Mia" },
    });
    const html = render({ filter: "approved", items: [decided] });
    expect(html).toContain(">Approved<");
    expect(html).toContain(
      requestsCopy.decidedLine("approved", "Mia", formatRequestTime(decided.decidedAt!)),
    );
    expect(html).not.toContain(requestsCopy.seatEmpty);
    const anon = render({ filter: "approved", items: [{ ...decided, decidedBy: null }] });
    expect(anon).toContain(
      requestsCopy.decidedLine("approved", null, formatRequestTime(decided.decidedAt!)),
    );
    expect(anon).not.toContain("by Mia");
  });
  it("hasMore shows Load more; loadingMore disables it; no button without hasMore", () => {
    expect(render({ hasMore: true })).toContain(requestsCopy.loadMore);
    const busy = render({ hasMore: true, loadingMore: true });
    expect(busy).toContain(requestsCopy.loadingMore);
    expect(busy).toContain("disabled");
    expect(render()).not.toContain(requestsCopy.loadMore);
  });
  it("Vietnamese name is rendered unchanged", () => {
    const html = render({
      items: [req({ id: "1", subject: { id: "u", displayName: "Nguyễn Thị Ánh" } })],
    });
    expect(html).toContain("Nguyễn Thị Ánh");
  });
  it("chip bar wrapper has overflow-x-auto", () => {
    expect(render()).toMatch(/overflow-x-auto[^>]*><div role="radiogroup"/);
  });
});
