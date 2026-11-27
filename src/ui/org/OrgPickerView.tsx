import type { OrgChoice } from "@/lib/identity/types";
import type { OrgNotice } from "@/lib/identity/orgs";
import { AuthLayout } from "../auth/AuthLayout";
import { Notice } from "../auth/fields";
import { Button } from "../Button";
import { authCopy } from "../copy/auth";
import { orgCopy } from "../copy/org";

/** Entry picker for a user with several orgs. Props only; names are data, rendered as text. */
export function OrgPickerView({
  orgs,
  notice,
  busyId,
  onPick,
  onSignOut,
}: {
  orgs: readonly OrgChoice[];
  notice?: OrgNotice;
  busyId?: string | null;
  onPick: (id: string) => void;
  onSignOut: () => void;
}) {
  return (
    <AuthLayout title={orgCopy.picker.title} scene={false}>
      {notice && <Notice kind="info">{orgCopy.notices[notice]}</Notice>}
      <ul aria-label={orgCopy.picker.listLabel} className="m-0 flex list-none flex-col gap-2 p-0">
        {orgs.map((o, i) => (
          <li key={o.id}>
            <Button
              variant="tonal"
              fullWidth
              className="whitespace-normal! break-words"
              autoFocus={i === 0}
              disabled={!!busyId}
              aria-busy={busyId === o.id ? true : undefined}
              onClick={() => onPick(o.id)}
            >
              {busyId === o.id ? orgCopy.picker.entering : o.name}
              {busyId !== o.id && o.access === "super_admin" && (
                <span className="ml-2 text-xs text-on-surface-variant">
                  {orgCopy.badge.supportAccess}
                </span>
              )}
            </Button>
          </li>
        ))}
      </ul>
      <Button variant="text" onClick={onSignOut}>
        {authCopy.actions.signOut}
      </Button>
    </AuthLayout>
  );
}
