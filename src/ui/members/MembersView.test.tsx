import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MemberDto } from "@/lib/members/types";
import { apiCopy } from "../copy/api";
import { membersCopy } from "../copy/members";
import { shellCopy } from "../copy/shell";
import { MembersView, type MembersViewProps } from "./MembersView";

const noop = () => {};
const base: MemberDto = {
  id: "1",
  displayName: "Nguyễn Thị Ánh",
  email: "anh@example.com",
  employeeCode: "E1",
  group: { id: "g1", name: "Dev", color: "#336699" },
  status: "active",
  hasPhoto: false,
  photoVersion: 0,
  seatCount: 1,
  deviceCount: 1,
  seats: [{ id: "s1", code: "C302-01" }],
  devices: [
    {
      id: "d1",
      name: "Laptop",
      inventoryNumber: "INV-1",
      role: "primary",
      seatId: "s1",
      seatCode: "C302-01",
    },
  ],
};
const gone: MemberDto = {
  ...base,
  id: "2",
  displayName: "Bình",
  status: "deactivated",
  employeeCode: null,
  group: null,
  seatCount: 0,
  deviceCount: 0,
  seats: [],
  devices: [],
};
const render = (p: Partial<MembersViewProps> = {}) =>
  renderToStaticMarkup(
    <MembersView
      status="ready"
      items={[base, gone]}
      errorCode={null}
      canManage={false}
      search=""
      statusFilter="active"
      searching={false}
      hasMore={false}
      loadingMore={false}
      invitations={null}
      onSearch={noop}
      onSearchCommit={noop}
      onStatusFilter={noop}
      onRetry={noop}
      onLoadMore={noop}
      onEdit={noop}
      onDeactivate={noop}
      onReactivate={noop}
      {...p}
    />,
  );

describe("MembersView", () => {
  it("deviceCount null renders a dash and Not shown, no device refs, no +N more", () => {
    const html = render({
      items: [{ ...base, id: "3", displayName: "Hidden", deviceCount: null, devices: [] }],
    });
    expect(html).toContain(`>${membersCopy.hiddenDevices}<`);
    expect(html).toContain(membersCopy.hiddenDevicesLabel);
    expect(html).not.toContain("INV-1");
    expect(html).not.toContain("more</li>");
  });

  it("renders a dash when email is null", () => {
    const html = render({ items: [{ ...base, id: "4", email: null }] });
    expect(html).toContain(`>${membersCopy.hiddenEmail}</td>`);
    expect(html).not.toContain("anh@example.com");
  });

  it("user sees no actions, no invitations section, accounts note present", () => {
    const html = render();
    expect(html).toContain(membersCopy.accountsNote.replace("'", "&#x27;"));
    expect(html).not.toContain(membersCopy.columns.actions);
    expect(html).not.toContain(`>${membersCopy.edit}<`);
    expect(html).not.toContain(`>${membersCopy.deactivate}<`);
    expect(html).not.toContain(`>${membersCopy.reactivate}<`);
    expect(html).not.toContain(membersCopy.invitations.heading);
  });

  it("manager sees Edit + Deactivate on active rows and Edit + Reactivate on deactivated rows", () => {
    const html = render({
      canManage: true,
      headerAction: <span>HEADER-SLOT</span>,
      invitations: {
        status: "ready",
        items: [
          {
            id: "i1",
            email: "new@example.com",
            role: "simap:manager",
            createdAt: "2026-03-05T17:30:00Z",
            expiresAt: null,
          },
        ],
        errorCode: null,
        reload: noop,
      },
    });
    expect(html).toContain(membersCopy.editLabel("Nguyễn Thị Ánh"));
    expect(html).toContain(membersCopy.deactivateLabel("Nguyễn Thị Ánh"));
    expect(html).not.toContain(membersCopy.reactivateLabel("Nguyễn Thị Ánh"));
    expect(html).toContain(membersCopy.editLabel("Bình"));
    expect(html).toContain(membersCopy.reactivateLabel("Bình"));
    expect(html).not.toContain(membersCopy.deactivateLabel("Bình"));
    expect(html).toContain(membersCopy.statusLabels.deactivated);
    expect(html).toContain("HEADER-SLOT");
    expect(html).toContain(membersCopy.invitations.heading);
    expect(html).toContain("new@example.com");
    expect(html).toContain("Manager");
    expect(html).toContain("06 Mar 2026");
    expect(html).toContain(membersCopy.invitations.noExpiry);
  });

  it("renders loading, error, and empty states", () => {
    expect(render({ status: "loading", items: [] })).toContain('aria-busy="true"');
    const err = render({ status: "error", items: [], errorCode: "unavailable" });
    expect(err).toContain('role="alert"');
    expect(err).toContain(apiCopy.errors.unavailable);
    expect(err).toContain(membersCopy.retry);
    expect(render({ items: [] })).toContain(shellCopy.pages.members.empty);
    expect(render({ items: [], searching: true })).toContain(membersCopy.emptyFiltered);
    expect(render({ items: [], statusFilter: "all" })).toContain(membersCopy.emptyFiltered);
  });

  it("shows Load more only when hasMore, and the loading text while loading", () => {
    expect(render()).not.toContain(membersCopy.loadMore);
    expect(render({ hasMore: true })).toContain(membersCopy.loadMore);
    const busy = render({ hasMore: true, loadingMore: true });
    expect(busy).toContain(membersCopy.loadingMore);
    expect(busy).toContain("disabled");
  });

  it("shows capped refs, placeholders and Vietnamese names", () => {
    const html = render({
      items: [
        {
          ...base,
          seatCount: 22,
          seats: Array.from({ length: 20 }, (_, i) => ({ id: `s${i}`, code: `R-${i}` })),
        },
        gone,
      ],
    });
    expect(html).toContain(membersCopy.moreRefs(2));
    expect(html).toContain(membersCopy.noGroup);
    expect(html).toContain(membersCopy.noCode);
    expect(html).toContain("Nguyễn Thị Ánh");
    expect(html).toContain(membersCopy.deviceRef("Laptop", "INV-1", "primary"));
  });

  it("invitations: empty and error with retry", () => {
    const empty = render({
      canManage: true,
      invitations: { status: "ready", items: [], errorCode: null, reload: noop },
    });
    expect(empty).toContain(membersCopy.invitations.empty);
    const err = render({
      canManage: true,
      invitations: { status: "error", items: [], errorCode: "unavailable", reload: noop },
    });
    expect(err).toContain(apiCopy.errors.unavailable);
    expect(err).toContain(membersCopy.invitations.retry);
  });
});

describe("MembersView photos (SIM-046.2)", () => {
  it("row shows the photo img when photoUrl returns a url, initials otherwise", () => {
    const html = render({
      items: [{ ...base, hasPhoto: true, photoVersion: 1 }, gone],
      photoUrl: (m) => (m.id === base.id ? "blob:ph-1" : null),
    });
    expect(html.split("<img")).toHaveLength(2);
    expect(html).toContain('src="blob:ph-1"');
    expect(render()).not.toContain("<img");
  });
  it("canManage=false: no Edit action, so no member card with Remove photo", () => {
    const html = render({ items: [{ ...base, hasPhoto: true, photoVersion: 1 }] });
    expect(html).not.toContain(`>${membersCopy.edit}<`);
    expect(html).not.toContain(membersCopy.photo.remove);
  });
});
