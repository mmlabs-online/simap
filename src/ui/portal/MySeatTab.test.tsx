import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { portalCopy } from "../copy/portal";
import { requestsCopy } from "../copy/requests";
import { MyRequestsView } from "../requests/MyRequestsView";
import { MySeatView } from "./MySeatView";
import { seatTabEmpty } from "./my-seats";

const noop = () => {};

// MySeatTab needs auth and fetch contexts; this renders both views with the props the tab derives from one `empty` value.
describe("My seat tab empty state", () => {
  it("no seat and no request renders one empty state", () => {
    const empty = seatTabEmpty([], "ready", 0);
    const html = renderToStaticMarkup(
      <MySeatView
        status="ready"
        seats={[]}
        errorCode={null}
        empty={empty}
        busy={false}
        notice={null}
        onRetry={noop}
        onRelease={noop}
        requests={
          <MyRequestsView
            embedded
            hideEmpty={empty}
            state="ready"
            items={[]}
            newIds={new Set()}
            hasMore={false}
            loadingMore={false}
            errorCode={null}
            cancellingId={null}
            notice={null}
            onRetry={noop}
            onLoadMore={noop}
            onCancel={noop}
          />
        }
      />,
    );
    expect(html.split(portalCopy.seat.empty)).toHaveLength(2);
    expect(html).not.toContain(requestsCopy.mine.empty);
    expect(html).not.toContain(portalCopy.seat.requestsHeading);
    expect(html.split('href="/rooms"')).toHaveLength(2);
  });
});
