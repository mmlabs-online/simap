import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DeviceHistoryEntryDto } from "@/lib/devices/types";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import { DeviceHistory, type DeviceHistoryProps } from "./DeviceHistory";

const noop = () => {};
const ha = { id: "a", displayName: "Nguyễn Văn Ánh" };
const bea = { id: "b", displayName: "Bea" };
const entry = (p: Partial<DeviceHistoryEntryDto>): DeviceHistoryEntryDto => ({
  id: "1",
  kind: "transfer_confirm",
  at: "2026-03-05T17:30:00.000000Z",
  actor: bea,
  from: ha,
  to: bea,
  note: "Hand over\nwith charger",
  expiresOn: "2026-12-31",
  fromExpiresOn: null,
  confirmedBy: bea,
  cause: null,
  ...p,
});

const render = (p: Partial<DeviceHistoryProps> = {}) =>
  renderToStaticMarkup(
    <DeviceHistory
      status="ready"
      items={[entry({})]}
      hasMore={false}
      loadingMore={false}
      moreError={false}
      errorCode={null}
      onRetry={noop}
      onLoadMore={noop}
      {...p}
    />,
  );

describe("DeviceHistory", () => {
  it("empty history shows the empty copy", () => {
    const html = render({ items: [] });
    expect(html).toContain(devicesCopy.history.empty);
    expect(html).not.toContain("<ol");
  });

  it("renders an ordered list in the given order with kind label, time in UTC+7 (2026-03-05T17:30:00.000000Z -> 06 Mar 2026, 00:30), actor, from -> to, note, expiry, confirmed by", () => {
    const html = render({
      items: [
        entry({ id: "1" }),
        entry({ id: "2", kind: "assign", from: null, to: ha, actor: ha, confirmedBy: null }),
      ],
    });
    expect(html).toContain("<ol");
    expect(html.match(/<li/g)).toHaveLength(2);
    expect(html.indexOf(devicesCopy.history.kinds.transfer_confirm)).toBeLessThan(
      html.indexOf(devicesCopy.history.kinds.assign),
    );
    for (const s of [
      "06 Mar 2026, 00:30",
      devicesCopy.history.byActor("Bea"),
      "Nguyễn Văn Ánh → Bea",
      "Hand over",
      "with charger",
      devicesCopy.history.expiry("2026-12-31"),
      devicesCopy.history.confirmedBy("Bea"),
      "Org inventory → Nguyễn Văn Ánh",
    ]) {
      expect(html).toContain(s);
    }
  });

  it("unknown member label for null actor; Load more only with nextCursor; busy and failed load-more states; history error does not hide anything else (own Retry)", () => {
    const unknown = render({ items: [entry({ actor: null })] });
    expect(unknown).toContain(devicesCopy.history.byActor(devicesCopy.history.unknownMember));
    expect(unknown).not.toContain(devicesCopy.history.loadMore);
    const more = render({ hasMore: true });
    expect(more).toContain(devicesCopy.history.loadMore);
    expect(more).not.toContain('disabled=""');
    expect(render({ hasMore: true, loadingMore: true })).toContain('disabled=""');
    const failed = render({ hasMore: true, moreError: true });
    expect(failed).toContain(devicesCopy.history.loadMoreFailed);
    expect(failed).toContain("Hand over");
    const err = render({ status: "error", items: [], errorCode: "unavailable" });
    expect(err).toContain('role="alert"');
    expect(err).toContain(apiErrorMessage("unavailable"));
    expect(err).toContain(devicesCopy.retry);
    expect(render({ status: "loading", items: [] })).toContain('aria-busy="true"');
  });
});
