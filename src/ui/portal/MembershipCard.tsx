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
          <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-workspace-action text-on-action text-label font-semibold">
            {orgName ? initials(orgName) : <Icon name="group" size={22} />}
          </span>
          <div className="flex min-w-0 flex-col">
            {orgName ? (
              <>
                <span className="truncate text-label font-semibold text-text-primary">
                  {orgName}
                </span>
                <span className="text-caption text-text-secondary">{copy.yourOrg}</span>
              </>
            ) : (
              <span className="text-label font-semibold text-text-primary">{copy.yourOrg}</span>
            )}
          </div>
          <span className="ml-auto">
            <RoleBadge tier={tier} />
          </span>
        </div>
        <p className="text-caption text-text-secondary">{copy.managed}</p>
      </div>
    </SectionCard>
  );
}
