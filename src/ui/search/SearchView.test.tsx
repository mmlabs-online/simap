import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DeviceHit, MemberHit, SeatHit } from "@/lib/search/types";
import { apiErrorMessage } from "../copy/api";
import { searchCopy as copy } from "../copy/search";
import { INITIAL_SEARCH, type SearchState } from "./search-state";
import { SearchView, type SearchViewProps } from "./SearchView";

const seat: SeatHit = {
  id: "s1",
  code: "C302-01",
  roomId: "r1",
  roomCode: "C302",
  occupant: { id: "m1", displayName: "Nguyễn Văn An" },
};
const device: DeviceHit = {
  id: "d1",
  name: "Laptop X1",
  inventoryNumber: "INV-001",
  mac: "AA:BB:CC:DD:EE:FF",
  owner: { id: "m1", displayName: "Nguyễn Văn An" },
  placement: { seatId: "s1", seatCode: "C302-01", roomId: "r1", roomCode: "C302", role: "primary" },
};
const member: MemberHit = {
  id: "m1",
  displayName: "Nguyễn Văn An",
  employeeCode: "E-001",
  status: "active",
};

const ready = (over: Partial<SearchState> = {}): SearchState => ({
  ...INITIAL_SEARCH,
  query: "an",
  status: "ready",
  seats: { ...INITIAL_SEARCH.seats, items: [seat] },
  devices: { ...INITIAL_SEARCH.devices, items: [device] },
  members: { ...INITIAL_SEARCH.members, items: [member] },
  ...over,
});

const render = (p: Partial<SearchViewProps> = {}) =>
  renderToStaticMarkup(
    <SearchView
      query="an"
      onQueryChange={() => {}}
      state={ready()}
      onRetry={() => {}}
      onLoadMore={() => {}}
      {...p}
    />,
  );

describe("SearchView", () => {
  it("idle: input with copy label, prompt text, no groups", () => {
    const html = render({ state: INITIAL_SEARCH, query: "" });
    expect(html).toContain(`aria-label="${copy.inputLabel}"`);
    expect(html).toContain(copy.prompt);
    expect(html).not.toContain("<h2");
  });

  it("input value reflects the query", () => {
    expect(render({ query: "Nguyễn" })).toContain('value="Nguyễn"');
  });

  it("loading: aria-busy skeleton", () => {
    const html = render({ state: { ...INITIAL_SEARCH, status: "loading" } });
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("<h2");
  });

  it("error: role=alert with apiErrorMessage and retry", () => {
    const html = render({
      state: { ...INITIAL_SEARCH, status: "error", errorCode: "unavailable" },
    });
    expect(html).toContain('role="alert"');
    expect(html).toContain(apiErrorMessage("unavailable"));
    expect(html).toContain(copy.retry);
  });

  it("ready: three groups in order Seats, Devices, Members", () => {
    const html = render();
    const at = [copy.groups.seats.title, copy.groups.devices.title, copy.groups.members.title].map(
      (t) => html.indexOf(`>${t}<`),
    );
    expect(at.every((i) => i > 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });

  it("seat row links to /rooms/<room>?seat=<code>; occupant verbatim; no occupant -> empty-seat copy; room .. -> no link", () => {
    const html = render();
    expect(html).toContain('href="/rooms/C302?seat=C302-01"');
    expect(html).toContain("Nguyễn Văn An");
    const empty = render({
      state: ready({ seats: { ...INITIAL_SEARCH.seats, items: [{ ...seat, occupant: null }] } }),
    });
    expect(empty).toContain(copy.emptySeat);
    const dots = render({
      state: ready({ seats: { ...INITIAL_SEARCH.seats, items: [{ ...seat, roomCode: ".." }] } }),
    });
    expect(dots).not.toContain("?seat=");
    expect(dots).toContain("C302-01");
  });

  it("device row links to /devices; shows inventory no., MAC when present, owner, placement or in-inventory copy", () => {
    const html = render();
    expect(html).toContain('href="/devices"');
    expect(html).toContain("INV-001");
    expect(html).toContain(copy.mac("AA:BB:CC:DD:EE:FF"));
    expect(html).toContain(copy.placement("C302", "C302-01"));
    const bare = render({
      state: ready({
        devices: { ...INITIAL_SEARCH.devices, items: [{ ...device, mac: null, placement: null }] },
      }),
    });
    expect(bare).not.toContain("MAC ");
    expect(bare).toContain(copy.inInventory);
  });

  it("member row links to /members; employee code when present; deactivated chip only for status deactivated", () => {
    const html = render();
    expect(html).toContain('href="/members"');
    expect(html).toContain("E-001");
    expect(html).not.toContain(copy.deactivated);
    const off = render({
      state: ready({
        members: {
          ...INITIAL_SEARCH.members,
          items: [{ ...member, employeeCode: null, status: "deactivated" }],
        },
      }),
    });
    expect(off).toContain(copy.deactivated);
    expect(off).not.toContain("E-001");
  });

  it("empty group shows its own empty text while other groups list rows", () => {
    const html = render({
      state: ready({ devices: { ...INITIAL_SEARCH.devices, items: [] } }),
    });
    expect(html).toContain(copy.groups.devices.empty);
    expect(html).not.toContain(copy.groups.seats.empty);
    expect(html).toContain("C302-01");
  });

  it("Load more only when the group has nextCursor", () => {
    expect(render()).not.toContain(copy.loadMore);
    const html = render({
      state: ready({ seats: { ...INITIAL_SEARCH.seats, items: [seat], nextCursor: "c" } }),
    });
    expect(html.split(copy.loadMore)).toHaveLength(2);
  });

  it("loading more: button disabled with loading text", () => {
    const html = render({
      state: ready({
        seats: { ...INITIAL_SEARCH.seats, items: [seat], nextCursor: "c", moreId: 4 },
      }),
    });
    expect(html).toContain("disabled");
    expect(html).toContain(copy.loadingMore);
    expect(html).not.toContain(copy.loadMore);
  });

  it("more error: alert with message and retry inside that group only", () => {
    const html = render({
      state: ready({
        members: {
          ...INITIAL_SEARCH.members,
          items: [member],
          nextCursor: "c",
          moreError: "unavailable",
        },
      }),
    });
    expect(html.match(/role="alert"/g)).toHaveLength(1);
    expect(html).toContain(apiErrorMessage("unavailable"));
    expect(html.indexOf('role="alert"')).toBeGreaterThan(
      html.indexOf(`>${copy.groups.members.title}<`),
    );
  });
});
