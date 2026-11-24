"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { MemberDto, MemberStatusFilter } from "@/lib/members/types";
import { atLeastTier } from "@/lib/tier";
import { useApiFetch } from "../auth/api-fetch-context";
import { useSession } from "../session";
import { DeactivateMemberDialog } from "./DeactivateMemberDialog";
import { EditMemberDialog } from "./EditMemberDialog";
import { createMembersApi } from "./members-api";
import { listQuery } from "./members-state";
import { MembersView } from "./MembersView";
import { ReactivateMemberDialog } from "./ReactivateMemberDialog";
import { useMembers } from "./useMembers";
import { usePendingInvitations } from "./usePendingInvitations";

const SEARCH_DEBOUNCE_MS = 250;

type Dialog = { kind: "edit" | "deactivate" | "reactivate"; member: MemberDto } | null;

/** Members page: list with search, status filter and (Manager+) edit, deactivate and reactivate. */
export function MembersPage({ headerAction }: { headerAction?: ReactNode }) {
  const apiFetch = useApiFetch();
  const session = useSession();
  const canManage = session ? atLeastTier(session.tier, "manager") : false;
  const api = useMemo(() => createMembersApi(apiFetch), [apiFetch]);

  const [search, setSearch] = useState("");
  const [committed, setCommitted] = useState("");
  const [statusFilter, setStatusFilter] = useState<MemberStatusFilter>("active");
  const [dialog, setDialog] = useState<Dialog>(null);

  useEffect(() => {
    const t = setTimeout(() => setCommitted(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const query = useMemo(() => listQuery(committed, statusFilter), [committed, statusFilter]);
  const members = useMembers(api, query);
  const invitations = usePendingInvitations(api, canManage);

  const close = () => setDialog(null);
  const done = () => {
    setDialog(null);
    void members.reload();
  };

  return (
    <>
      <MembersView
        status={members.status}
        items={members.items}
        errorCode={members.errorCode}
        canManage={canManage}
        search={search}
        statusFilter={statusFilter}
        searching={query.q !== ""}
        hasMore={members.hasMore}
        loadingMore={members.loadingMore}
        invitations={invitations}
        headerAction={headerAction}
        onSearch={(v) => {
          setSearch(v);
          if (v === "") setCommitted("");
        }}
        onSearchCommit={() => setCommitted(search)}
        onStatusFilter={setStatusFilter}
        onRetry={() => void members.reload()}
        onLoadMore={() => void members.loadMore()}
        onEdit={(member) => setDialog({ kind: "edit", member })}
        onDeactivate={(member) => setDialog({ kind: "deactivate", member })}
        onReactivate={(member) => setDialog({ kind: "reactivate", member })}
      />
      <EditMemberDialog
        member={dialog?.kind === "edit" ? dialog.member : null}
        groups={members.groups}
        api={api}
        onClose={close}
        onDone={done}
      />
      <DeactivateMemberDialog
        member={dialog?.kind === "deactivate" ? dialog.member : null}
        api={api}
        onClose={close}
        onDone={done}
      />
      <ReactivateMemberDialog
        member={dialog?.kind === "reactivate" ? dialog.member : null}
        api={api}
        onClose={close}
        onDone={done}
      />
    </>
  );
}
