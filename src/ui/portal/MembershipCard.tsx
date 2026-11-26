import type { Tier } from "@/lib/tier";
import { initials } from "@/lib/format";
import { portalCopy } from "../copy/portal";
import { Icon } from "../Icon";
import { RoleBadge } from "../RoleBadge";
import { SectionCard } from "../SectionCard";

const copy = portalCopy.profile.membership;

/** Card 2: the organization, the caller's simap role (read only) and the managed note. Pure view. */
export function MembershipCard({ orgName, tier }: { orgName?: string; tier: Tier }) {
  return (
    <SectionCard headingId="profile-membership-heading" title={copy.title} icon="group">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-primary-container text-on-primary-container text-sm font-extrabold">
            {orgName ? initials(orgName) : <Icon name="group" size={22} />}
          </span>
          <div className="flex min-w-0 flex-col">
            {orgName ? (
              <>
                <span className="truncate text-sm font-bold text-on-surface">{orgName}</span>
                <span className="text-xs text-on-surface-variant">{copy.yourOrg}</span>
              </>
            ) : (
              <span className="text-sm font-bold text-on-surface">{copy.yourOrg}</span>
            )}
          </div>
          <span className="ml-auto">
            <RoleBadge tier={tier} />
          </span>
        </div>
        <p className="text-xs text-on-surface-variant">{copy.managed}</p>
      </div>
    </SectionCard>
  );
}
