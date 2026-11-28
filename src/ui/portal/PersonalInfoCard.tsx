import type { ReactNode } from "react";
import { DISPLAY_NAME_MAX } from "@/lib/validate/member";
import { Pill } from "../Chip";
import { portalCopy } from "../copy/portal";
import { FilledInput } from "../FilledInput";
import { SectionCard } from "../SectionCard";
import { nameLength } from "./profile-draft";

const copy = portalCopy.profile;
const LABEL = "flex items-center gap-1 text-label text-text-primary";

/** Card 1: the photo slot, the display name with a counter, and the read-only email. Pure view. */
export function PersonalInfoCard({
  photo,
  name,
  email,
  nameError,
  busy,
  onNameChange,
}: {
  photo: ReactNode;
  name: string;
  email: string;
  nameError: "required" | "invalid" | null;
  busy: boolean;
  onNameChange: (name: string) => void;
}) {
  const noteId = nameError ? "portal-name-error" : "portal-name-hint";
  return (
    <SectionCard
      headingId="profile-personal-heading"
      title={copy.personal.title}
      subtitle={copy.personal.subtitle}
      icon="person"
    >
      <div className="flex flex-col gap-5">
        {photo}
        <div className="flex flex-col gap-1">
          <label htmlFor="portal-name" className={LABEL}>
            {copy.nameLabel}
            <span aria-hidden="true" className="text-text-primary">
              *
            </span>
          </label>
          <FilledInput
            id="portal-name"
            icon="person"
            type="text"
            autoComplete="nickname"
            maxLength={DISPLAY_NAME_MAX}
            required
            readOnly={busy}
            value={name}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={`${noteId} portal-name-count`}
            onChange={(e) => onNameChange(e.target.value)}
          />
          <div className="flex items-start justify-between gap-3">
            {nameError ? (
              <small id="portal-name-error" role="alert" className="text-caption text-danger">
                {copy.errors[nameError]}
              </small>
            ) : (
              <small id="portal-name-hint" className="text-caption text-text-secondary">
                {copy.nameHint}
              </small>
            )}
            <small id="portal-name-count" className="flex-none text-caption text-text-secondary">
              {copy.counter(nameLength(name), DISPLAY_NAME_MAX)}
            </small>
          </div>
        </div>
        <hr className="border-divider" />
        <div className="flex flex-col gap-1">
          <label htmlFor="portal-email" className={LABEL}>
            {copy.emailLabel}
            <Pill tone="neutral" label={copy.readOnly} />
          </label>
          <FilledInput
            id="portal-email"
            icon="mail"
            trailingIcon="lock"
            type="email"
            readOnly
            value={email}
            aria-describedby="portal-email-hint"
          />
          <small id="portal-email-hint" className="text-caption text-text-secondary">
            {copy.emailManaged}
          </small>
        </div>
      </div>
    </SectionCard>
  );
}
