import { apiErrorMessage } from "../copy/api";
import { membersCopy } from "../copy/members";
import { Button } from "../Button";
import { Card } from "../Card";
import { TABLE_CELL, TABLE_HEAD, TABLE_ROW } from "../table";
import { formatInviteDate, invitationRoleLabel } from "./members-state";
import type { InvitationsState } from "./usePendingInvitations";

/** Read-only list of invitations sent from simap (MEM-01, D16). Pure: data comes from props. */
export function PendingInvitations({ state }: { state: InvitationsState }) {
  const c = membersCopy.invitations;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-subtitle text-text-primary">{c.heading}</h2>
      <p className="text-label text-text-secondary">{c.note}</p>
      {state.status === "loading" && (
        <Card className="h-20 animate-pulse">
          <div aria-busy="true" className="h-full" />
        </Card>
      )}
      {state.status === "error" && (
        <Card className="flex flex-col items-start gap-3 p-4">
          <p role="alert" className="text-label font-semibold text-danger">
            {apiErrorMessage(state.errorCode ?? "internal")}
          </p>
          <Button variant="tonal" size="sm" onClick={state.reload}>
            {c.retry}
          </Button>
        </Card>
      )}
      {state.status === "ready" && state.items.length === 0 && (
        <Card className="px-6 py-6 text-center">
          <p className="text-label text-text-secondary">{c.empty}</p>
        </Card>
      )}
      {state.status === "ready" && state.items.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-128 border-collapse">
            <thead>
              <tr className="border-b border-divider">
                <th className={TABLE_HEAD}>{c.columns.email}</th>
                <th className={TABLE_HEAD}>{c.columns.role}</th>
                <th className={TABLE_HEAD}>{c.columns.sent}</th>
                <th className={TABLE_HEAD}>{c.columns.expires}</th>
              </tr>
            </thead>
            <tbody>
              {state.items.map((i) => (
                <tr key={i.id} className={TABLE_ROW}>
                  <td className={`${TABLE_CELL} break-all`}>{i.email}</td>
                  <td className={TABLE_CELL}>{invitationRoleLabel(i.role)}</td>
                  <td className={`${TABLE_CELL} whitespace-nowrap`}>
                    {formatInviteDate(i.createdAt)}
                  </td>
                  <td className={`${TABLE_CELL} whitespace-nowrap`}>
                    {formatInviteDate(i.expiresAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </section>
  );
}
