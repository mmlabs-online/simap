import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { REQUEST_STATUSES, type MyRequestDto } from "@/lib/requests/types";
import { apiErrorMessage } from "../copy/api";
import { portalCopy } from "../copy/portal";
import { requestsCopy } from "../copy/requests";
import { MyRequestsView, type MyRequestsViewProps } from "./MyRequestsView";
import { formatRequestTime } from "./requests-state";

const noop = () => {};
const req = (over: Partial<MyRequestDto> & { id: string }): MyRequestDto => ({
  status: "pending",
  seat: { id: "s1", code: "A1", roomId: "r1", roomCode: "R1" },
  subject: { id: "u1", displayName: "Ann" },
  createdAt: "2026-03-05T17:30:00.000000Z",
  decidedAt: null,
  decidedBy: null,
  isNew: false,
  ...over,
});
const render = (p: Partial<MyRequestsViewProps> = {}) =>
  renderToStaticMarkup(
    <MyRequestsView
      state="ready"
      items={[req({ id: "1" })]}
      newIds={new Set()}
      hasMore={false}
      loadingMore={false}
      errorCode={null}
      cancellingId={null}
      notice={null}
      onRetry={noop}
      onLoadMore={noop}
      onCancel={noop}
      {...p}
    />,
  );

describe("MyRequestsView", () => {
  it("loading shows aria-busy skeleton and no list", () => {
    const html = render({ state: "loading", items: [] });
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("<ul");
  });
  it("error shows apiErrorMessage as role=alert and a Try again button", () => {
    const html = render({ state: "error", items: [], errorCode: "unavailable" });
    expect(html).toContain('role="alert"');
    expect(html).toContain(apiErrorMessage("unavailable"));
    expect(html).toContain(requestsCopy.retry);
  });
  it("empty shows the mine empty text", () => {
    const html = render({ items: [] });
    expect(html).toContain(requestsCopy.mine.empty);
    expect(html).not.toContain("<ul");
  });
  it("hideEmpty renders nothing when ready and empty; still renders items and loading", () => {
    expect(render({ items: [], hideEmpty: true, embedded: true })).toBe("");
    expect(render({ hideEmpty: true })).toContain("<ul");
    expect(render({ state: "loading", items: [], hideEmpty: true })).toContain('aria-busy="true"');
  });
  it("ready rows: seat line, status chip for every status incl. Pending, requested time, decided line with diacritics kept", () => {
    for (const status of REQUEST_STATUSES) {
      const html = render({ items: [req({ id: "1", status })] });
      expect(html).toContain(requestsCopy.statusLabel[status]);
      expect(html).toContain(requestsCopy.seatLine("A1", "R1"));
    }
    const decided = render({
      items: [
        req({
          id: "2",
          status: "approved",
          decidedAt: "2026-03-05T18:00:00.000000Z",
          decidedBy: { id: "m", displayName: "Nguyễn Thị Hương" },
        }),
      ],
    });
    expect(decided).toContain(requestsCopy.requestedAt("06 Mar 2026, 00:30"));
    expect(decided).toContain("Nguyễn Thị Hương");
    expect(decided).toContain(
      requestsCopy.decidedLine(
        "approved",
        "Nguyễn Thị Hương",
        formatRequestTime("2026-03-05T18:00:00.000000Z"),
      ),
    );
    expect(render({ items: [req({ id: "1" })] })).not.toContain(" on 06 Mar");
  });
  it("New chip only on rows whose id is in newIds; none when newIds is empty", () => {
    const items = [req({ id: "1" }), req({ id: "2" })];
    const html = render({ items, newIds: new Set(["2"]) });
    expect(html.split(`>${requestsCopy.mine.newChip}<`)).toHaveLength(2);
    expect(render({ items, newIds: new Set() })).not.toContain(`>${requestsCopy.mine.newChip}<`);
    // The view follows newIds, not item.isNew.
    expect(render({ items: [req({ id: "1", isNew: true })] })).not.toContain(
      `>${requestsCopy.mine.newChip}<`,
    );
  });
  it("Cancel only on pending rows; cancellingId disables every Cancel and labels the busy one", () => {
    const items = [
      req({ id: "1" }),
      req({ id: "2", status: "approved", decidedAt: "2026-03-05T18:00:00.000000Z" }),
      req({ id: "3" }),
    ];
    const idle = render({ items });
    expect(idle.split(`>${requestsCopy.mine.cancel}<`)).toHaveLength(3);
    expect(idle).not.toContain('disabled=""');
    const busy = render({ items, cancellingId: "1" });
    expect(busy).toContain(`>${requestsCopy.mine.cancelling}<`);
    expect(busy.match(/<button[^>]*\sdisabled=""/g)).toHaveLength(2);
    expect(render({ items: [items[1]] })).not.toContain("<button");
  });
  it("notice: status tone is role=status, error tone is role=alert", () => {
    const status = render({ notice: { tone: "status", text: "Done" } });
    expect(status).toMatch(/<p role="status"[^>]*>Done</);
    expect(status).not.toContain('role="alert"');
    const error = render({ notice: { tone: "error", text: "Nope" } });
    expect(error).toMatch(/<p role="alert"[^>]*>Nope</);
    expect(error).not.toContain('role="status"');
  });
  it("Load more shows only when hasMore; loadingMore disables it", () => {
    expect(render()).not.toContain(requestsCopy.loadMore);
    expect(render({ hasMore: true })).toContain(`>${requestsCopy.loadMore}<`);
    expect(render({ hasMore: true, loadingMore: true })).toMatch(
      new RegExp(`<button[^>]*\\sdisabled=""[^>]*>${requestsCopy.loadingMore}<`),
    );
  });
  it("embedded: h2 not h1, no page padding, Cancel only on pending rows; default mode unchanged", () => {
    const items = [req({ id: "1" }), req({ id: "2", status: "approved" })];
    const html = render({ embedded: true, items });
    expect(html).toContain("<h2");
    expect(html).toContain(portalCopy.seat.requestsHeading);
    expect(html).not.toContain("<h1");
    expect(html).not.toContain("p-4 lg:p-6");
    expect(html.match(/<button/g)).toHaveLength(1);
    const page = render({ items });
    expect(page).toContain("<h1");
    expect(page).not.toContain("<h2");
    expect(page).toContain("p-4 lg:p-6");
  });
});
