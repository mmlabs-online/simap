import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MyRequestDto, RequestStatus } from "@/lib/requests/types";
import { apiErrorMessage } from "../copy/api";
import { portalCopy } from "../copy/portal";
import { requestsCopy } from "../copy/requests";
import {
  MyRequestsPanel,
  MyRequestsPanelView,
  type MyRequestsPanelViewProps,
} from "./MyRequestsPanel";

const noop = () => {};
const req = (id: string, status: RequestStatus = "pending"): MyRequestDto => ({
  id,
  status,
  seat: { id: "s1", code: `A${id}`, roomId: "r1", roomCode: "R1" },
  subject: { id: "u1", displayName: "Ann" },
  createdAt: "2026-03-05T17:30:00.000000Z",
  decidedAt: null,
  decidedBy: null,
  isNew: false,
});
const five = [
  req("1", "pending"),
  req("2", "approved"),
  req("3", "pending"),
  req("4", "rejected"),
  req("5", "cancelled"),
];
const props = (p: Partial<MyRequestsPanelViewProps> = {}): MyRequestsPanelViewProps => ({
  state: "ready",
  items: five,
  newIds: new Set(),
  hasMore: false,
  loadingMore: false,
  errorCode: null,
  cancellingId: null,
  filter: "all",
  onFilter: noop,
  onRetry: noop,
  onLoadMore: noop,
  onCancel: noop,
  ...p,
});
const render = (p: Partial<MyRequestsPanelViewProps> = {}) =>
  renderToStaticMarkup(<MyRequestsPanelView {...props(p)} />);
const rows = (html: string) => html.match(/<li /g)?.length ?? 0;

describe("MyRequestsPanel", () => {
  it("header: h3 My requests, count pill, subtitle, SegmentedFilter labelled portalCopy.seat.filterLabel", () => {
    const html = render();
    expect(html).toMatch(/<h3[^>]*>My requests<\/h3>/);
    expect(html).toContain(">5<");
    expect(html).toContain(portalCopy.seat.requestsSubtitle);
    expect(html).toContain(`aria-label="${portalCopy.seat.filterLabel}"`);
  });
  it("default filter is All (aria-pressed); All renders one row per item in server order", () => {
    const html = render();
    expect(html).toMatch(new RegExp(`aria-pressed="true"[^>]*>${portalCopy.seat.filterAll}<`));
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(rows(html)).toBe(5);
    const order = ["A1", "A2", "A3", "A4", "A5"].map((c) => html.indexOf(`>Seat ${c}<`));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((i) => i > 0)).toBe(true);
  });
  it('filter="pending" narrows to the pending rows; the count pill still shows the total; live region "Showing 2 of 5 requests"', () => {
    const html = render({ filter: "pending" });
    expect(rows(html)).toBe(2);
    expect(html).toContain(">5<");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Showing 2 of 5 requests");
  });
  it("filtered empty shows requestsCopy.emptyFor[filter]; Load more still shows when hasMore under any filter", () => {
    const html = render({ items: [req("1", "pending")], filter: "rejected", hasMore: true });
    expect(rows(html)).toBe(0);
    expect(html).toContain(requestsCopy.emptyFor.rejected);
    expect(html).toContain(`>${requestsCopy.loadMore}<`);
  });
  it('count pill shows "50+" when hasMore', () => {
    expect(render({ hasMore: true })).toContain(">5+<");
  });
  it('loading aria-busy; error role=alert + Try again; ready-empty shows requestsCopy.mine.empty; hideEmpty and ready-empty → ""', () => {
    const loading = render({ state: "loading", items: [] });
    expect(loading).toContain('aria-busy="true"');
    expect(loading).not.toContain("<ul");
    const error = render({ state: "error", items: [], errorCode: "unavailable" });
    expect(error).toContain('role="alert"');
    expect(error).toContain(apiErrorMessage("unavailable"));
    expect(error).toContain(requestsCopy.retry);
    const empty = render({ items: [] });
    expect(empty).toContain(requestsCopy.mine.empty);
    expect(empty).not.toContain("<ul");
    expect(render({ items: [], hideEmpty: true })).toBe("");
    expect(render({ hideEmpty: true })).toContain("<ul");
  });
  it('Load more only when hasMore; loadingMore disables it with "Loading..."', () => {
    expect(render()).not.toContain(requestsCopy.loadMore);
    expect(render({ hasMore: true })).toContain(`>${requestsCopy.loadMore}<`);
    expect(render({ hasMore: true, loadingMore: true })).toMatch(
      new RegExp(`<button[^>]*\\sdisabled=""[^>]*>${requestsCopy.loadingMore}<`),
    );
  });
  it("MyRequestsPanel (stateful) renders with All pressed", () => {
    const { filter: _f, onFilter: _o, ...rest } = props();
    const html = renderToStaticMarkup(<MyRequestsPanel {...rest} />);
    expect(html).toMatch(new RegExp(`aria-pressed="true"[^>]*>${portalCopy.seat.filterAll}<`));
    expect(rows(html)).toBe(5);
  });
});
