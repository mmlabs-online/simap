import type { ReactNode } from "react";
import type { Tier } from "@/lib/tier";
import { portalCopy } from "../copy/portal";
import { FormFooterBar, type FooterStatus } from "../FormFooterBar";
import { Icon } from "../Icon";
import { PageHeader } from "../PageHeader";
import { MembershipCard } from "./MembershipCard";
import { PersonalInfoCard } from "./PersonalInfoCard";

const copy = portalCopy.profile;

export type ProfileTabViewProps = {
  name: string;
  email: string;
  tier: Tier;
  orgName?: string;
  nameError: "required" | "invalid" | null;
  onNameChange: (name: string) => void;
  busy: boolean;
  photo: ReactNode;
  /** The pixel character card; null when the caller has no member id. */
  character: ReactNode | null;
  footer: { status: FooterStatus; canSave: boolean; canCancel: boolean };
  onCancel: () => void;
};

/** The Profile tab layout: header, two columns (1 below lg), footer. Pure: no autofocus, no state. */
export function ProfileTabView(p: ProfileTabViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        aside={
          <span className="inline-flex items-center gap-1 text-caption text-text-secondary">
            <Icon name="lock" size={16} />
            {copy.visibility}
          </span>
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="flex flex-col gap-6">
          <PersonalInfoCard
            photo={p.photo}
            name={p.name}
            email={p.email}
            nameError={p.nameError}
            busy={p.busy}
            onNameChange={p.onNameChange}
          />
          <MembershipCard orgName={p.orgName} tier={p.tier} />
        </div>
        {p.character !== null && <div>{p.character}</div>}
      </div>
      <FormFooterBar
        status={p.footer.status}
        cancelLabel={copy.footer.cancel}
        saveLabel={copy.footer.save}
        busyLabel={copy.footer.saving}
        canCancel={p.footer.canCancel}
        canSave={p.footer.canSave}
        busy={p.busy}
        onCancel={p.onCancel}
      />
    </div>
  );
}
