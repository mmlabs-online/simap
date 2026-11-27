import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { apiCopy } from "../copy/api";
import { groupsCopy } from "../copy/groups";
import { GroupsView, type GroupsViewProps } from "./GroupsView";

const noop = () => {};
const ready = { status: "ready", items: [], errorCode: null } as const;
const render = (p: Partial<GroupsViewProps> = {}) =>
  renderToStaticMarkup(
    <GroupsView
      access="ok"
      groups={ready}
      projects={ready}
      onNew={noop}
      onEditGroup={noop}
      onEditProject={noop}
      onDeleteGroup={noop}
      onDeleteProject={noop}
      onRetry={noop}
      {...p}
    />,
  );

const group = { id: "g1", name: "Nhóm A", color: "#3366ff" };
const project = { id: "p1", code: "KT", name: "Kỹ thuật" };

describe("GroupsView", () => {
  it("forbidden shows the no-access text, no lists and no buttons", () => {
    const html = render({ access: "forbidden" });
    expect(html).toContain(groupsCopy.noAccess);
    expect(html).not.toContain("<h2");
    expect(html).not.toContain("<button");
  });
  it("loading marks both sections busy", () => {
    const loading = { status: "loading", items: [], errorCode: null } as const;
    const html = render({ groups: loading, projects: loading });
    expect(html.match(/aria-busy="true"/g)).toHaveLength(2);
  });
  it("one list in error and one ready are independent", () => {
    const html = render({
      groups: { status: "error", items: [], errorCode: "unavailable" },
      projects: { status: "ready", items: [project], errorCode: null },
    });
    expect(html).toContain('role="alert"');
    expect(html).toContain(apiCopy.errors.unavailable);
    expect(html).toContain(groupsCopy.retry);
    expect(html).toContain("Kỹ thuật");
  });
  it("ready and empty shows the per-list empty texts", () => {
    const html = render();
    expect(html).toContain(groupsCopy.group.empty);
    expect(html).toContain(groupsCopy.project.empty);
  });
  it("ready rows show the color dot, names, codes, row actions and both New buttons", () => {
    const html = render({
      groups: { status: "ready", items: [group], errorCode: null },
      projects: { status: "ready", items: [project], errorCode: null },
    });
    expect(html).toContain("background-color:#3366ff");
    expect(html).toContain("Nhóm A");
    expect(html).toContain(`aria-label="${groupsCopy.group.editLabel("Nhóm A")}"`);
    expect(html).toContain(`aria-label="${groupsCopy.group.deleteLabel("Nhóm A")}"`);
    expect(html).toContain("KT");
    expect(html).toContain(`aria-label="${groupsCopy.project.editLabel("KT")}"`);
    expect(html).toContain(`aria-label="${groupsCopy.project.deleteLabel("KT")}"`);
    expect(html).toContain(groupsCopy.group.new);
    expect(html).toContain(groupsCopy.project.new);
    expect(html).toMatch(/<h2[^>]*text-subtitle/);
    expect(html).toMatch(/font-semibold[^>]*>Nhóm A</);
    expect(html).not.toMatch(/font-(bold|extrabold)/);
  });
});
