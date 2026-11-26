"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { DISPLAY_NAME_MAX } from "@/lib/validate/member";
import { Button } from "../Button";
import { portalCopy } from "../copy/portal";
import { shellCopy } from "../copy/shell";
import { FilledInput } from "../FilledInput";
import { validateProfileName } from "../org/profile-form";
import type { Tier } from "@/lib/tier";

const copy = portalCopy.profile;

export type ProfileTabViewProps = {
  initialName: string;
  email: string;
  tier: Tier;
  saving: boolean;
  /** Set by the container after a refused save. */
  error?: "invalid" | null;
  notice: { tone: "status" | "error"; text: string } | null;
  onSubmit: (name: string) => void;
  /** Self-contained sections rendered above the name form (photo; SIM-047.1 adds the character picker). */
  sections?: ReactNode;
};

/** The Profile tab form. Pure: no autofocus; the typed value survives a failed save. */
export function ProfileTabView({
  initialName,
  email,
  tier,
  saving,
  error,
  notice,
  onSubmit,
  sections,
}: ProfileTabViewProps) {
  const [name, setName] = useState(initialName);
  const [local, setLocal] = useState<"required" | "invalid" | null>(null);
  const fieldError = local ?? error ?? null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const check = validateProfileName(name);
    if (!check.ok) {
      setLocal(check.error);
      return;
    }
    setLocal(null);
    onSubmit(check.value);
  };

  return (
    <div className="flex flex-col gap-4 max-w-md">
      <h2 className="text-lg font-extrabold text-on-surface">{copy.heading}</h2>
      {sections}
      <form method="post" noValidate onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="portal-name" className="text-xs font-semibold text-on-surface-variant">
            {copy.nameLabel}
          </label>
          <FilledInput
            id="portal-name"
            icon="person"
            type="text"
            autoComplete="nickname"
            maxLength={DISPLAY_NAME_MAX}
            required
            value={name}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? "portal-name-error" : "portal-name-hint"}
            onChange={(e) => {
              setName(e.target.value);
              setLocal(null);
            }}
          />
          {fieldError ? (
            <small id="portal-name-error" role="alert" className="text-xs text-error">
              {copy.errors[fieldError]}
            </small>
          ) : (
            <small id="portal-name-hint" className="text-xs text-on-surface-variant">
              {copy.nameHint}
            </small>
          )}
        </div>
        <div>
          <Button type="submit" disabled={saving}>
            {saving ? copy.saving : copy.save}
          </Button>
        </div>
      </form>
      {notice &&
        (notice.tone === "error" ? (
          <p role="alert" className="text-sm font-semibold text-error">
            {notice.text}
          </p>
        ) : (
          <p role="status" className="text-sm font-semibold text-on-surface">
            {notice.text}
          </p>
        ))}
      <dl className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs font-semibold text-on-surface-variant">{copy.email}</dt>
          <dd className="break-words text-sm text-on-surface">{email}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs font-semibold text-on-surface-variant">{copy.role}</dt>
          <dd className="text-sm text-on-surface">{shellCopy.tiers[tier]}</dd>
        </div>
        <p className="text-xs text-on-surface-variant">{copy.managed}</p>
      </dl>
    </div>
  );
}
