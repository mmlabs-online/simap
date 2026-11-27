"use client";

import { useState, type FormEvent } from "react";
import { DISPLAY_NAME_MAX } from "@/lib/validate/member";
import { AuthLayout } from "../auth/AuthLayout";
import { Notice } from "../auth/fields";
import { Button } from "../Button";
import { authCopy } from "../copy/auth";
import { profileCopy } from "../copy/profile";
import { FilledInput } from "../FilledInput";
import { validateProfileName } from "./profile-form";

export type ProfileError = "required" | "invalid" | "retry";

/** First-visit display name form. Props only; the entered value survives a failed save. */
export function ProfileView({
  initialName,
  email,
  status,
  error,
  onSubmit,
  onSignOut,
}: {
  initialName: string;
  email: string;
  status: "idle" | "submitting";
  error?: ProfileError | null;
  onSubmit: (name: string) => void;
  onSignOut?: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [local, setLocal] = useState<"required" | "invalid" | null>(null);
  const submitting = status === "submitting";
  const fieldError = local ?? (error === "required" || error === "invalid" ? error : null);
  const saveError = !local && error === "retry";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const check = validateProfileName(name);
    if (!check.ok) {
      setLocal(check.error);
      return;
    }
    setLocal(null);
    onSubmit(check.value);
  };

  return (
    <AuthLayout title={profileCopy.title}>
      <p className="break-words text-label font-normal text-text-secondary">
        {profileCopy.intro(email)}
      </p>
      {saveError && <Notice kind="error">{profileCopy.errors.retry}</Notice>}
      <form method="post" noValidate onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="profile-name" className="text-label text-text-primary">
            {profileCopy.label}
          </label>
          <FilledInput
            id="profile-name"
            icon="person"
            type="text"
            autoComplete="nickname"
            maxLength={DISPLAY_NAME_MAX}
            required
            autoFocus
            value={name}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? "profile-name-error" : "profile-name-hint"}
            onChange={(e) => {
              setName(e.target.value);
              setLocal(null);
            }}
          />
          {fieldError ? (
            <small id="profile-name-error" role="alert" className="text-caption text-danger">
              {profileCopy.errors[fieldError]}
            </small>
          ) : (
            <small id="profile-name-hint" className="text-caption text-text-secondary">
              {profileCopy.hint}
            </small>
          )}
        </div>
        <Button type="submit" size="lg" fullWidth disabled={submitting}>
          {submitting ? profileCopy.saving : profileCopy.submit}
        </Button>
      </form>
      {onSignOut && (
        <Button variant="text" onClick={onSignOut}>
          {authCopy.actions.signOut}
        </Button>
      )}
    </AuthLayout>
  );
}
