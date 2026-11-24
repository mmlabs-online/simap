import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { groupsCopy } from "../copy/groups";
import type { GroupsApi } from "./groups-api";
import { DeleteDialog, DeleteImpactBody } from "./DeleteDialog";

const body = (p: Parameters<typeof DeleteImpactBody>[0]) =>
  renderToStaticMarkup(<DeleteImpactBody {...p} />);

describe("DeleteImpactBody", () => {
  it("plain: the plain question with the item label", () => {
    const html = body({ kind: "group", label: "Nhóm A", impact: { seats: 0, members: 0 } });
    expect(html).toContain(groupsCopy.group.deleteBody("Nhóm A"));
    expect(html).not.toContain("<ul");
  });
  it("forced group: intro, seat and member counts and the cleared-not-deleted note", () => {
    const html = body({ kind: "group", label: "Nhóm A", impact: { seats: 2, members: 1 } });
    expect(html).toContain(groupsCopy.group.forceDeleteIntro("Nhóm A"));
    expect(html).toContain("2 seats");
    expect(html).toContain("1 member");
    expect(html).toContain(groupsCopy.group.forceDeleteNote);
  });
  it("forced project: seats only", () => {
    const html = body({ kind: "project", label: "KT", impact: { seats: 3 } });
    expect(html).toContain("3 seats");
    expect(html).not.toContain("member");
    expect(html).toContain(groupsCopy.project.forceDeleteNote);
  });
  it("the forced submit label differs from the plain one", () => {
    expect(groupsCopy.group.forceDeleteSubmit).not.toBe(groupsCopy.group.deleteSubmit);
    expect(groupsCopy.project.forceDeleteSubmit).not.toBe(groupsCopy.project.deleteSubmit);
  });
});

describe("DeleteDialog", () => {
  it("before the impact loads: title present, submit disabled", () => {
    const html = renderToStaticMarkup(
      <DeleteDialog
        target={{ kind: "group", item: { id: "g", name: "Nhóm A", color: "#3366ff" } }}
        api={{} as GroupsApi}
        onClose={() => {}}
        onDone={() => {}}
      />,
    );
    expect(html).toContain(groupsCopy.group.deleteTitle);
    expect(html).toMatch(
      /<button[^>]*disabled[^>]*type="submit"|<button[^>]*type="submit"[^>]*disabled/,
    );
  });
});
