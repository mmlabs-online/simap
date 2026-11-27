import type { GroupDto, ProjectDto } from "@/lib/groups/types";
import { groupsCopy } from "../copy/groups";
import { shellCopy } from "../copy/shell";
import { Button } from "../Button";
import { Card } from "../Card";
import { ListSection, type ListState } from "./ListSection";

export type GroupsViewProps = {
  access: "ok" | "forbidden";
  groups: ListState<GroupDto>;
  projects: ListState<ProjectDto>;
  onNew: (kind: "group" | "project") => void;
  onEditGroup: (group: GroupDto) => void;
  onEditProject: (project: ProjectDto) => void;
  onDeleteGroup: (group: GroupDto) => void;
  onDeleteProject: (project: ProjectDto) => void;
  onRetry: (kind: "group" | "project") => void;
};

function RowActions({
  editLabel,
  deleteLabel,
  onEdit,
  onDelete,
}: {
  editLabel: string;
  deleteLabel: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <Button variant="tonal" size="sm" icon="edit" aria-label={editLabel} onClick={onEdit}>
        {groupsCopy.edit}
      </Button>
      <Button variant="danger" size="sm" aria-label={deleteLabel} onClick={onDelete}>
        {groupsCopy.delete}
      </Button>
    </div>
  );
}

/** The Groups and projects page body. Pure: data and handlers come from props. */
export function GroupsView(props: GroupsViewProps) {
  const title = (
    <h1 className="text-h2 font-extrabold text-on-surface">{shellCopy.pages.groups.title}</h1>
  );
  if (props.access === "forbidden") {
    return (
      <div className="page-content flex flex-col gap-4">
        {title}
        <Card className="px-6 py-12 text-center">
          <p role="alert" className="text-sm font-medium text-on-surface-variant">
            {groupsCopy.noAccess}
          </p>
        </Card>
      </div>
    );
  }
  return (
    <div className="page-content flex flex-col gap-6">
      {title}
      <ListSection
        title={groupsCopy.group.title}
        newLabel={groupsCopy.group.new}
        emptyText={groupsCopy.group.empty}
        list={props.groups}
        rowKey={(g) => g.id}
        onNew={() => props.onNew("group")}
        onRetry={() => props.onRetry("group")}
        renderRow={(g) => (
          <>
            <div className="flex items-center gap-3 min-w-0">
              <span
                aria-hidden="true"
                className="size-4 shrink-0 rounded-full border border-outline-variant"
                style={{ backgroundColor: g.color }}
              />
              <span className="truncate text-sm font-bold text-on-surface">{g.name}</span>
            </div>
            <RowActions
              editLabel={groupsCopy.group.editLabel(g.name)}
              deleteLabel={groupsCopy.group.deleteLabel(g.name)}
              onEdit={() => props.onEditGroup(g)}
              onDelete={() => props.onDeleteGroup(g)}
            />
          </>
        )}
      />
      <ListSection
        title={groupsCopy.project.title}
        newLabel={groupsCopy.project.new}
        emptyText={groupsCopy.project.empty}
        list={props.projects}
        rowKey={(p) => p.id}
        onNew={() => props.onNew("project")}
        onRetry={() => props.onRetry("project")}
        renderRow={(p) => (
          <>
            <div className="flex items-baseline gap-3 min-w-0">
              <span className="shrink-0 text-sm font-extrabold text-on-surface">{p.code}</span>
              <span className="truncate text-sm font-medium text-on-surface-variant">{p.name}</span>
            </div>
            <RowActions
              editLabel={groupsCopy.project.editLabel(p.code)}
              deleteLabel={groupsCopy.project.deleteLabel(p.code)}
              onEdit={() => props.onEditProject(p)}
              onDelete={() => props.onDeleteProject(p)}
            />
          </>
        )}
      />
    </div>
  );
}
