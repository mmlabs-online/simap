import { apiErrorMessage } from "../copy/api";
import { membersCopy } from "../copy/members";
import { Button } from "../Button";
import { Card } from "../Card";
import { formatInviteDate, invitationRoleLabel } from "./members-state";
import type { InvitationsState } from "./usePendingInvitations";

const CELL = "px-3 py-2 align-top text-sm text-on-surface";
const HEAD = "px-3 py-2 text-left text-[11px] font-extrabold uppercase text-on-surface-variant";

/** Read-only list of invitations sent from simap (MEM-01, D16). Pure: data comes from props. */
export function PendingInvitations({ state }: { state: InvitationsState }) {
  const c = membersCopy.invitations;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-extrabold text-on-surface">{c.heading}</h2>
      <p className="text-sm font-medium text-on-surface-variant">{c.note}</p>
      {state.status === "loading" && (
        <Card className="h-20 animate-pulse">
          <div aria-busy="true" className="h-full" />
        </Card>
      )}
      {state.status === "error" && (
        <Card className="flex flex-col items-start gap-3 p-4">
          <p role="alert" className="text-sm font-semibold text-error">
            {apiErrorMessage(state.errorCode ?? "internal")}
          </p>
          <Button variant="tonal" size="sm" onClick={state.reload}>
            {c.retry}
          </Button>
        </Card>
      )}
      {state.status === "ready" && state.items.length === 0 && (
        <Card className="px-6 py-6 text-center">
          <p className="text-sm font-medium text-on-surface-variant">{c.empty}</p>
        </Card>
      )}
      {state.status === "ready" && state.items.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse">
            <thead>
              <tr className="border-b border-outline-variant">
                <th className={HEAD}>{c.columns.email}</th>
                <th className={HEAD}>{c.columns.role}</th>
                <th className={HEAD}>{c.columns.sent}</th>
                <th className={HEAD}>{c.columns.expires}</th>
              </tr>
            </thead>
            <tbody>
              {state.items.map((i) => (
                <tr key={i.id} className="border-b border-outline-variant last:border-b-0">
                  <td className={`${CELL} break-all`}>{i.email}</td>
                  <td className={CELL}>{invitationRoleLabel(i.role)}</td>
                  <td className={`${CELL} whitespace-nowrap`}>{formatInviteDate(i.createdAt)}</td>
                  <td className={`${CELL} whitespace-nowrap`}>{formatInviteDate(i.expiresAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </section>
  );
}
