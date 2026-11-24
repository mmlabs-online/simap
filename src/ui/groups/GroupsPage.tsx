"use client";

import { useMemo, useState } from "react";
import { useApiFetch } from "../auth/api-fetch-context";
import { useSession } from "../session";
import { DeleteDialog, type DeleteTarget } from "./DeleteDialog";
import { GroupsView } from "./GroupsView";
import { createGroupsApi } from "./groups-api";
import { canManageGroups } from "./groups-state";
import { TagFormDialog, type TagTarget } from "./TagFormDialog";
import { useList } from "./useList";

type Dialog =
  | { kind: "none" }
  | { kind: "form"; target: TagTarget }
  | { kind: "delete"; target: DeleteTarget };

const NO_LIST = { status: "ready", items: [], errorCode: null } as const;
const noop = () => {};

/** Groups and projects page. Below Manager it shows the no-access message and mounts no data hook. */
export function GroupsPage() {
  const session = useSession();
  if (!canManageGroups(session?.tier)) {
    return (
      <GroupsView
        access="forbidden"
        groups={NO_LIST}
        projects={NO_LIST}
        onNew={noop}
        onEditGroup={noop}
        onEditProject={noop}
        onDeleteGroup={noop}
        onDeleteProject={noop}
        onRetry={noop}
      />
    );
  }
  return <GroupsLoaded />;
}

function GroupsLoaded() {
  const apiFetch = useApiFetch();
  const api = useMemo(() => createGroupsApi(apiFetch), [apiFetch]);
  const groups = useList(api.groups.list);
  const projects = useList(api.projects.list);
  const [dialog, setDialog] = useState<Dialog>({ kind: "none" });

  const close = () => setDialog({ kind: "none" });
  const done = (kind: "group" | "project") => {
    close();
    void (kind === "group" ? groups.reload() : projects.reload());
  };

  return (
    <>
      <GroupsView
        access="ok"
        groups={groups}
        projects={projects}
        onNew={(kind) =>
          setDialog({
            kind: "form",
            target:
              kind === "group" ? { kind: "group", item: null } : { kind: "project", item: null },
          })
        }
        onEditGroup={(item) => setDialog({ kind: "form", target: { kind: "group", item } })}
        onEditProject={(item) => setDialog({ kind: "form", target: { kind: "project", item } })}
        onDeleteGroup={(item) => setDialog({ kind: "delete", target: { kind: "group", item } })}
        onDeleteProject={(item) => setDialog({ kind: "delete", target: { kind: "project", item } })}
        onRetry={(kind) => void (kind === "group" ? groups.reload() : projects.reload())}
      />
      {dialog.kind === "form" && (
        <TagFormDialog
          target={dialog.target}
          api={api}
          onClose={close}
          onDone={() => done(dialog.target.kind)}
        />
      )}
      {dialog.kind === "delete" && (
        <DeleteDialog
          target={dialog.target}
          api={api}
          onClose={close}
          onDone={() => done(dialog.target.kind)}
        />
      )}
    </>
  );
}
