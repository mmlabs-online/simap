import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { groupsCopy } from "../copy/groups";
import { kitCopy } from "../copy/kit";
import { DEFAULT_GROUP_COLOR } from "./group-form";
import type { GroupsApi } from "./groups-api";
import { TagFormDialog } from "./TagFormDialog";

const noop = () => {};
const api = {} as GroupsApi;

describe("TagFormDialog", () => {
  it("create group: create title, name field and the default color", () => {
    const html = renderToStaticMarkup(
      <TagFormDialog
        target={{ kind: "group", item: null }}
        api={api}
        onClose={noop}
        onDone={noop}
      />,
    );
    expect(html).toContain(groupsCopy.group.createTitle);
    expect(html).toContain(groupsCopy.fields.groupName);
    expect(html).toContain('type="color"');
    expect(html).toContain(`value="${DEFAULT_GROUP_COLOR}"`);
    expect(html).toContain(groupsCopy.group.create);
  });
  it("edit project: edit title, code and name prefilled, Save label", () => {
    const html = renderToStaticMarkup(
      <TagFormDialog
        target={{ kind: "project", item: { id: "p", code: "KT", name: "Kỹ thuật" } }}
        api={api}
        onClose={noop}
        onDone={noop}
      />,
    );
    expect(html).toContain(groupsCopy.project.editTitle);
    expect(html).toContain('value="KT"');
    expect(html).toContain('value="Kỹ thuật"');
    expect(html).toContain(kitCopy.save);
  });
});
